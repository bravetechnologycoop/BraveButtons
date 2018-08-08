import http.client

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
                
            print('seconds since flic was last seen: ' + str(last_seen_secs))

if __name__ == '__main__':
    parse_darkstat_html_lines(get_darkstat_html().splitlines())
