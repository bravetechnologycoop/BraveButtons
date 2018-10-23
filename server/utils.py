import http.client
import json

def send_rename_request(name, system_id):
    body = {"system_id": system_id, "system_name": name}
    headers = {"Content-Type": "application/json"}
    try:
        conn = http.client.HTTPSConnection("heartbeat.brave.coop", timeout=10)
        conn.request("POST", r"/rename_system", json.dumps(body), headers)
        res = conn.getresponse()
        print("response to rename request:", res.status, res.reason)
    except Exception as e:
        print("error sending rename request")
        print(e)
