import http.client
import time
import datetime
import json
import uuid
import configparser
import os
import re
import platform
import subprocess
import pathlib
import logging
import logging.handlers

config = configparser.ConfigParser()
configPath = pathlib.Path(os.path.dirname(__file__)) / 'pi_config.ini'
config.read(str(configPath))

SERVER_URL = config['Heartbeat']['heartbeatServerFQDN']
FLIC_MAC_ADDRESS = config['Heartbeat']['flicMACAddress']
NETWORK_INTERFACE = config['Setup']['network_interface']
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
        logging.warning("error connecting to darkstat", exc_info=e)
        return ""

class FlicNotFoundError(Exception):
    pass

def parse_flic_last_seen_from_darkstat_html(html, flic_mac_address):
    lines = html.splitlines()
    last_seen_secs_list = []
    for i in range(0, len(lines)):
        # match lines that contain an actual value for flic last seen
        # sometimes darkstat gives '(never)' in place of a value
        if (lines[i].count(flic_mac_address) > 0) and (lines[i+4].count('(never)') == 0):
            logging.info('darkstat html contains flic last seen info: {ip} {hostname} {mac} {lastseen}'.format(ip=lines[i-2], hostname=lines[i-1], mac=lines[i], lastseen=lines[i+4]))

            last_seen_string = lines[i+4]

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

def parse_flic_ip_from_darkstat_html(html, mac_address):
    lines = html.splitlines()
    for i in range(0, len(lines)):
        if (lines[i].count(mac_address) > 0):
            # this guards against some cases where multiple entries have the same MAC address
            # we want the entry where there is an IPv4 address that probably represents the flic hub
            flic_ip_strings = re.findall( r'[0-9]+(?:\.[0-9]+){3}', lines[i-2])
            if (len(flic_ip_strings) > 0):
                if flic_ip_strings[0] != '0.0.0.0':
                    logging.info('darkstat html contained flic IPv4 address: {ip} {hostname} {mac} {lastseen}'.format(ip=lines[i-2], hostname=lines[i-1], mac=lines[i], lastseen=lines[i+4]))

                    return flic_ip_strings[0]

    raise FlicNotFoundError('darkstat html did not contain an ip address for the mac address ' + mac_address)

def ping(host):
    param = '-n' if platform.system().lower()=='windows' else '-c'
    command = ['ping', param, '1', host]
    logging.info('running: {}'.format(command))
    returncode = subprocess.run(command, stdout=subprocess.DEVNULL).returncode
    logging.info('returned: {}'.format(returncode))
    return returncode == 0

def parse_link_quality_from_iwconfig_output(iwconfig_output_text):
    lines = iwconfig_output_text.split('\n')
    if len(lines) > 5:
        # lines[5] should be something like 'Link Quality=69/70  Signal level=-41 dBm' which we then split
        stats_strings = lines[5].split('  ')
        for i in range(0, len(stats_strings)):
            if 'Link Quality' in stats_strings[i]:
                quality_string = stats_strings[i].split('=')[1]
                # normalize the fraction since the denominator varies
                numerator = quality_string.split('/')[0]
                denominator = quality_string.split('/')[1]
                link_quality = float(numerator) / float(denominator)
                logging.info('wlan0 link quality is %f', link_quality)
                return
    logging.warning("error parsing iwconfig output")

def log_wifi_link_quality():
    try:
        iwconfig_output_text = subprocess.check_output(['iwconfig', 'wlan0']).decode('utf-8')
        parse_link_quality_from_iwconfig_output(iwconfig_output_text)
    except Exception as e:
        logging.warning("error logging wifi link quality", exc_info=e)

def send_heartbeat(flic_last_seen_secs, flic_last_ping_secs, system_id):
    body = {"flic_last_seen_secs" : str(flic_last_seen_secs),
            "flic_last_ping_secs" : str(flic_last_ping_secs),
            "system_id" : str(system_id)}
    headers = {'Content-Type':'application/json'}
    try:
        conn = http.client.HTTPSConnection(SERVER_URL, timeout=10)
        time_0 = datetime.datetime.now()
        conn.request('POST', r'/heartbeat', json.dumps(body), headers)
        res = conn.getresponse()
        time_1 = datetime.datetime.now()
        latency = (time_1 - time_0).total_seconds()
        logging.info('sent heartbeat, got response: %d %s', res.status, res.reason)
        logging.info('heartbeat latency was %f', latency)
        if res.status == 200:
            return True
        return False
    except Exception as e:
        logging.warning("error sending heartbeat", exc_info=e)
        return False

if __name__ == '__main__':

    # only import pi-specific libraries when running as a script
    # this allows us to run tests on a dev machine without these libs installed
    import daemon
    import gpiozero

    stdout_file = open('/var/log/brave/heartbeat-out.log', 'a')
    stderr_file = open('/var/log/brave/heartbeat-err.log', 'a')

    context = daemon.DaemonContext(
        stdout=stdout_file,
        stderr=stderr_file
    )

    with context:

        h = logging.handlers.RotatingFileHandler('/var/log/brave/heartbeat.log', maxBytes=100000000, backupCount=10)
        logging.basicConfig(format='%(asctime)s - %(message)s', level=logging.INFO, handlers=[h])

        logging.info('starting heartbeat script')

        relay = gpiozero.OutputDevice(RELAY_PIN)
        relay.on()

        led = gpiozero.OutputDevice(LED_PIN)
        led.on()

        last_ping = datetime.datetime.now()

        system_ok = False
        system_id = get_system_id_from_path('/usr/local/brave/system_id')
        flic_last_reboot = datetime.datetime.now()

        run_loop_last_run_time = datetime.datetime.now()

        while True:
            try:
                if NETWORK_INTERFACE == 'wlan0':
                    log_wifi_link_quality()
                html = get_darkstat_html()
                ip = parse_flic_ip_from_darkstat_html(html, FLIC_MAC_ADDRESS)
                if ping(ip):
                    last_ping = datetime.datetime.now()
                num_secs_darkstat = parse_flic_last_seen_from_darkstat_html(html, FLIC_MAC_ADDRESS)
                num_secs_ping = (datetime.datetime.now() - last_ping).total_seconds()
                system_ok = send_heartbeat(num_secs_darkstat, num_secs_ping, system_id)
                if not system_ok:
                    # retry heartbeat request once
                    # if the issue was a timeout error and the retry works, this will avoid turning off the Flic hub
                    system_ok = send_heartbeat(num_secs_darkstat, num_secs_ping, system_id)
            except FlicNotFoundError as e:
                # this means that the flic didn't show up in darkstat's list of hosts
                # typically this happens on startup for a few seconds until the flic becomes active on the network
                system_ok = True
                logging.info(str(e))
            except Exception as e:
                system_ok = False
                logging.warning('error in main loop', exc_info=e)
            finally:
                if system_ok:
                    relay.on()
                    led.on()
                else:
                    relay.off()
                    led.off()

                # run the loop at most once every 10 seconds
                # if the run loop takes longer then 10 seconds we don't need to sleep (eg. if http requests time out)
                run_loop_duration = (datetime.datetime.now() - run_loop_last_run_time).total_seconds()
                sleep_time = max(10.0 - run_loop_duration, 0.0)
                time.sleep(sleep_time)
                run_loop_last_run_time = datetime.datetime.now()
