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

class Test__get_system_id_from_path(object):

    def test_when_system_id_has_not_been_generated(self, tmp_path):
        p = tmp_path / 'system_id'
        p.touch()
        assert p.read_text() == ''
        system_id = heartbeat.get_system_id_from_path(str(p))
        assert len(system_id) == 36
        assert p.read_text() == system_id

    def test_when_system_id_has_already_been_generated(self, tmp_path):
        p = tmp_path / 'system_id'
        system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
        p.write_text(system_id)
        assert heartbeat.get_system_id_from_path(str(p)) == system_id
        assert p.read_text() == system_id
