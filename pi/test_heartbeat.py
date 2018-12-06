import heartbeat
import pytest

class Test__parse_darkstat_html_lines(object):

    def test_seconds(self):
        with open('./sample_darkstat_html/59_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_darkstat_html_lines(html.splitlines()) == 59

    def test_minutes(self):
        with open('./sample_darkstat_html/316_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_darkstat_html_lines(html.splitlines()) == 316

    def test_empty_html(self):
        with pytest.raises(heartbeat.FlicNotFoundError):
            heartbeat.parse_darkstat_html_lines(['', '', ''])
