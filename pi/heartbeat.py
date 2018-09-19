import http.client
import gpiozero
import time
import datetime

SERVER_URL = 'heartbeat.brave.coop'
GPIO_PIN = 26

def get_darkstat_html():
    try:
        conn = http.client.HTTPConnection('localhost:8888')
        conn.request('GET', r'/hosts/')
        res = conn.getresponse()
        html_string = res.read().decode('utf-8')
        conn.close()
        return html_string
    except Exception as e:
        print(datetime.datetime.now(), " - error connecting to darkstat")
        print(e, flush=True)
        return ""

def parse_darkstat_html_lines(lines):
    last_seen_secs_list = []
    for i in range(0, len(lines)):
        if lines[i].count('flic') > 0:
            last_seen_string = lines[i+5]
            
            last_seen_string = last_seen_string.replace(r'<td class="num">',  '')
            last_seen_string = last_seen_string.replace(r'</td></tr>', '')
            
            last_seen_secs = 0
            
            time_components = last_seen_string.split(',')
            for component in time_components:
                parts = component.strip().partition(' ')
                value = int(parts[0])
                units = parts[2]
                if units == 'mins':
                    value = value * 60
                last_seen_secs = last_seen_secs + value
                
            return last_seen_secs

    return 999999

def send_heartbeat(flic_ok):
    body = '{"flic_ok":false}'
    if flic_ok:
        body = '{"flic_ok":true}'
    headers = {'Content-Type':'application/json'}
    try:
        conn = http.client.HTTPSConnection(SERVER_URL)
        conn.request('POST', r'/heartbeat', body, headers)
        res = conn.getresponse()
        print(datetime.datetime.now(), ' - sent heartbeat, got response: ', res.status, res.reason, flush=True)
        if res.status == 200:
            return True
        return False
    except:
        return False

if __name__ == '__main__':
    
    # wait for reboot to finish
    time.sleep(10)
    
    print("\nstarting heartbeat script")
    print(datetime.datetime.now())
    print("\n", flush=True)

    relay = gpiozero.OutputDevice(GPIO_PIN)
    relay.on()

    server_connection_ok = False
    flic_last_reboot = datetime.datetime.now()
    
    while True: 

        # reboot the flic hub every 5 mins, unless we're keeping it off because we can't reach the server
        if server_connection_ok and (datetime.datetime.now() - flic_last_reboot > datetime.timedelta(minutes=5)):
            relay.off()
            time.sleep(1)
            relay.on()
            flic_last_reboot = datetime.datetime.now()

        try:
            num_secs = parse_darkstat_html_lines(get_darkstat_html().splitlines())
            if num_secs < 70:
                server_connection_ok = send_heartbeat(True)
            else:
                server_connection_ok = send_heartbeat(False)
        except ValueError as e:
            print(e, flush=True)
        finally:
            if server_connection_ok:
                relay.on()
            else:
                relay.off()
            time.sleep(5)
