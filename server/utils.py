import requests

def send_rename_request(server_url, system_id, name):
    payload = {"system_id": system_id, "system_name": name}
    try:
        r = requests.post(server_url + r"/rename_system", json=payload)
        print("response to rename request:", r.status_code, r.reason)
    except Exception as e:
        print("error sending rename request")
        print(e)
