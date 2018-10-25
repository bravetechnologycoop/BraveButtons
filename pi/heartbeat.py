import http.client
import gpiozero
import time
import datetime
import daemon
import json
import uuid

SERVER_URL = 'heartbeat.brave.coop'
GPIO_PIN = 26

def get_system_id():
    with open('/usr/local/brave/system_id', 'r+') as system_id_file:
        contents = system_id_file.read()
        if len(contents) == 36:
            return contents
        else:
            system_id = str(uuid.uuid4())
            if len(system_id) != 36:
                raise Exception("couldn't generate a valid system id")
            system_id_file.write(system_id)
            return system_id

def write_darkstat_html_to_file(html):
    try:
        date_string = str(datetime.datetime.now()).replace(" ", "-")
        with open('/usr/local/brave/darkstat_html/' + date_string + '.html', 'w') as html_file:
            html_file.write(html)
    except Exception as e:
        print(datetime.datetime.now(), " - error writing darkstat html to file")
        print(e, flush=True)

def get_darkstat_html():
    try:
        conn = http.client.HTTPConnection('localhost:8888',timeout=10)
        conn.request('GET', r'/hosts/?sort=lastseen')
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
                if units == 'mins' or units == 'min':
                    value = value * 60
                elif units == 'hrs' or units == 'hr':
                    value = value * 3600
                last_seen_secs = last_seen_secs + value

            return last_seen_secs

    raise Exception('darkstat html did not contain flic last seen info')

def send_heartbeat(flic_last_seen_secs, system_id):
    body = {"flic_last_seen_secs" : str(flic_last_seen_secs),
            "system_id" : str(system_id)}
    headers = {'Content-Type':'application/json'}
    try:
        conn = http.client.HTTPSConnection(SERVER_URL, timeout=10)
        conn.request('POST', r'/heartbeat', json.dumps(body), headers)
        res = conn.getresponse()
        print(datetime.datetime.now(), ' - sent heartbeat, got response: ', res.status, res.reason, flush=True)
        if res.status == 200:
            return True
        return False
    except Exception as e:
        print(datetime.datetime.now(), " - error sending heartbeat")
        print(e, flush=True)
        return False

if __name__ == '__main__':

    logfile_out = open('/var/log/brave/heartbeat-out.log', 'a')
    logfile_err = open('/var/log/brave/heartbeat-err.log', 'a')

    context = daemon.DaemonContext(
        stdout=logfile_out,
        stderr=logfile_err
    )

    with context:

        print("\nstarting heartbeat script")
        print(datetime.datetime.now())
        print("\n", flush=True)

        relay = gpiozero.OutputDevice(GPIO_PIN)
        relay.on()

        system_ok = False
        system_id = get_system_id()
        flic_last_reboot = datetime.datetime.now()

        while True:

            # reboot the flic hub every 5 mins, unless we're keeping it off because we can't reach the server
            if system_ok and (datetime.datetime.now() - flic_last_reboot > datetime.timedelta(minutes=30)):
                relay.off()
                time.sleep(1)
                relay.on()
                flic_last_reboot = datetime.datetime.now()

            try:
                html = get_darkstat_html()
                num_secs = parse_darkstat_html_lines(html.splitlines())
                if num_secs > 58:
                    write_darkstat_html_to_file(html)
                system_ok = send_heartbeat(num_secs, system_id)
            except Exception as e:
                system_ok = False
                print(datetime.datetime.now(), " - error in main loop")
                print(e, flush=True)
            finally:
                if system_ok:
                    relay.on()
                else:
                    relay.off()
                time.sleep(5)
