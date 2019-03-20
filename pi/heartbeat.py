import http.client
import time
import datetime
import json
import uuid
import configparser
import os

config = configparser.ConfigParser()
config.read(os.path.dirname(__file__) + '/pi_config.ini')

SERVER_URL = config['Heartbeat']['heartbeatServerFQDN']
RELAY_PIN = 10
LED_PIN = 9

def get_system_id_from_path(path):
    with open(path, 'r+') as system_id_file:
        contents = system_id_file.read()
        if len(contents) == 36:
            return contents
        else:
            system_id = str(uuid.uuid4())
            if len(system_id) != 36:
                raise Exception("couldn't generate a valid system id")
            system_id_file.write(system_id)
            return system_id

def get_darkstat_html():
    try:
        conn = http.client.HTTPConnection('localhost:8888',timeout=10)
        conn.request('GET', r'/hosts/?sort=lastseen')
        res = conn.getresponse()
        html_string = res.read().decode('utf-8')
        conn.close()
        return html_string
    except Exception as e:
        print(datetime.datetime.now().isoformat(), " - error connecting to darkstat")
        print(e, flush=True)
        return ""

class FlicNotFoundError(Exception):
    pass

def parse_darkstat_html_lines(lines):
    last_seen_secs_list = []
    for i in range(0, len(lines)):
        # match lines that contain an actual value for flic last seen
        # sometimes darkstat gives '(never)' in place of a value
        if (lines[i].count('flic') > 0) and (lines[i+5].count('(never)') == 0):
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

    raise FlicNotFoundError('darkstat html did not contain flic last seen info')

def send_heartbeat(flic_last_seen_secs, system_id):
    body = {"flic_last_seen_secs" : str(flic_last_seen_secs),
            "system_id" : str(system_id)}
    headers = {'Content-Type':'application/json'}
    try:
        conn = http.client.HTTPSConnection(SERVER_URL, timeout=10)
        time_0 = datetime.datetime.now()
        conn.request('POST', r'/heartbeat', json.dumps(body), headers)
        res = conn.getresponse()
        time_1 = datetime.datetime.now()
        latency = (time_1 - time_0).total_seconds()
        print(datetime.datetime.now().isoformat(), '- sent heartbeat, got response:', res.status, res.reason, flush=True)
        print(datetime.datetime.now().isoformat(), '- heartbeat latency was', latency)
        if res.status == 200:
            return True
        return False
    except Exception as e:
        print(datetime.datetime.now().isoformat(), " - error sending heartbeat")
        print(e, flush=True)
        return False

if __name__ == '__main__':

    # only import pi-specific libraries when running as a script
    # this allows us to run tests on a dev machine without these libs installed
    import daemon
    import gpiozero

    logfile_out = open('/var/log/brave/heartbeat-out.log', 'a')
    logfile_err = open('/var/log/brave/heartbeat-err.log', 'a')

    context = daemon.DaemonContext(
        stdout=logfile_out,
        stderr=logfile_err
    )

    with context:

        print("\nstarting heartbeat script")
        print(datetime.datetime.now().isoformat())
        print("\n", flush=True)

        relay = gpiozero.OutputDevice(RELAY_PIN)
        relay.on()

        led = gpiozero.OutputDevice(LED_PIN)
        led.on()

        system_ok = False
        system_id = get_system_id_from_path('/usr/local/brave/system_id')
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
                system_ok = send_heartbeat(num_secs, system_id)
            except FlicNotFoundError as e:
                # this means that the flic didn't show up in darkstat's list of hosts
                # typically this happens on startup for a few seconds until the flic becomes active on the network
                system_ok = True
                print(datetime.datetime.now().isoformat(), " - flic not found in darkstat html", flush=True)
            except Exception as e:
                system_ok = False
                print(datetime.datetime.now().isoformat(), " - error in main loop")
                print(e, flush=True)
            finally:
                if system_ok:
                    relay.on()
                    led.on()
                else:
                    relay.off()
                    led.off()
                time.sleep(1)
