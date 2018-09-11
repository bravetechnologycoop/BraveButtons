import http.client
import gpiozero
import time

SERVER_URL = 'heartbeat.brave.coop'
GPIO_PIN = 26

def get_darkstat_html():
    conn = http.client.HTTPConnection('localhost:8888')
    conn.request('GET', r'/hosts/')
    res = conn.getresponse()
    html_string = res.read().decode('utf-8')
    conn.close()
    return html_string

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
    conn = http.client.HTTPSConnection(SERVER_URL)
    conn.request('POST', r'/heartbeat', body, headers)
    res = conn.getresponse()
    print('sent heartbeat, got response: ', res.status, res.reason)

if __name__ == '__main__':

    relay = gpiozero.OutputDevice(GPIO_PIN)
    relay.on()

    while True: 
        try:
            num_secs = parse_darkstat_html_lines(get_darkstat_html().splitlines())
            if num_secs < 70:
                send_heartbeat(True)
            else:
                send_heartbeat(False)
        finally:
            time.sleep(1)
