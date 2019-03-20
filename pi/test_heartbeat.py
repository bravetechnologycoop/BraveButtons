import heartbeat
import pytest
import unittest.mock
import socket
import os

class Test__parse_darkstat_html_lines(object):

    def test_seconds(self):
        with open(os.path.dirname(__file__) + '/sample_darkstat_html/59_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_darkstat_html_lines(html.splitlines()) == 59

    def test_seconds_minutes(self):
        with open(os.path.dirname(__file__) + '/sample_darkstat_html/316_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_darkstat_html_lines(html.splitlines()) == 316

    def test_seconds_minutes_hours(self):
        with open(os.path.dirname(__file__) + '/sample_darkstat_html/3806_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_darkstat_html_lines(html.splitlines()) == 3806

    def test_empty_html(self):
        with pytest.raises(heartbeat.FlicNotFoundError):
            heartbeat.parse_darkstat_html_lines(['', '', ''])

    def test_never(self):
        with pytest.raises(heartbeat.FlicNotFoundError):
            with open(os.path.dirname(__file__) + '/sample_darkstat_html/never.html', 'r') as html_file:
                html = html_file.read()
                heartbeat.parse_darkstat_html_lines(html.splitlines())

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

class Test__send_heartbeat(object):

    def test_when_heartbeat_server_is_working(self):
        with unittest.mock.patch('http.client.HTTPSConnection') as MockHTTPSConnection:
                mock_connection = MockHTTPSConnection.return_value
                mock_response = unittest.mock.MagicMock()
                mock_response.status = 200
                mock_connection.getresponse.return_value = mock_response
                mock_connection.request = unittest.mock.MagicMock()

                system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
                flic_last_seen_secs = 5
                success = heartbeat.send_heartbeat(flic_last_seen_secs, system_id)

                assert success == True
                assert mock_connection.request.called

    def test_when_heartbeat_server_is_not_working(self):
        with unittest.mock.patch('http.client.HTTPSConnection') as MockHTTPSConnection:
                mock_connection = MockHTTPSConnection.return_value
                mock_response = unittest.mock.MagicMock()
                mock_response.status = 500
                mock_connection.getresponse.return_value = mock_response
                mock_connection.request = unittest.mock.MagicMock()

                system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
                flic_last_seen_secs = 5
                success = heartbeat.send_heartbeat(flic_last_seen_secs, system_id)

                assert success == False
                assert mock_connection.request.called

    def test_when_request_times_out(self):
        with unittest.mock.patch('http.client.HTTPSConnection') as MockHTTPSConnection:
                mock_connection = MockHTTPSConnection.return_value
                mock_connection.request = unittest.mock.MagicMock(side_effect=socket.timeout())

                system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
                flic_last_seen_secs = 5
                success = heartbeat.send_heartbeat(flic_last_seen_secs, system_id)

                assert success == False
                assert mock_connection.request.called

class Test__get_darkstat_html(object):

    def test_return_value(self):
        with unittest.mock.patch('http.client.HTTPConnection') as MockHTTPConnection:
            mock_connection = MockHTTPConnection.return_value
            mock_response = unittest.mock.MagicMock()
            mock_connection.getresponse.return_value = mock_response
            test_html = '<html></html>'
            mock_response.read.return_value = test_html.encode('utf-8')

            assert test_html == heartbeat.get_darkstat_html()

    def test_when_request_times_out(self):
        with unittest.mock.patch('http.client.HTTPConnection') as MockHTTPConnection:
            mock_connection = MockHTTPConnection.return_value
            mock_connection.request = unittest.mock.MagicMock(side_effect=socket.timeout())

            assert '' == heartbeat.get_darkstat_html()

