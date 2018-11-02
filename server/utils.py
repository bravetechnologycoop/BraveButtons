import requests

def send_rename_request(server_url, system_id, name):
    payload = {"system_id": system_id, "system_name": name}
    try:
        r = requests.post(server_url + r"/rename_system", json=payload)
        print("response to rename request:", r.status_code, r.reason)
    except Exception as e:
        print("error sending rename request")
        print(e)

def send_heartbeat(server_url, system_id, flic_last_seen_secs):
    payload = {"system_id": system_id, "flic_last_seen_secs": flic_last_seen_secs}
    try:
        r = requests.post(server_url + r"/heartbeat", json = payload)
        print("response to heartbeat:", r.status_code, r.reason)
    except Exception as e:
        print("error sending heartbeat")
        print(e)

