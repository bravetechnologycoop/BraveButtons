import heartbeat
import pytest
import unittest.mock
import socket
import os
import time
import datetime

patch = unittest.mock.patch

class Test__parse_flic_last_seen_from_darkstat_html(object):

    def test_seconds(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_darkstat_html/59_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_flic_last_seen_from_darkstat_html(html, '00:00:00:00:00:02') == 59

    def test_seconds_minutes(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_darkstat_html/316_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_flic_last_seen_from_darkstat_html(html, '00:00:00:00:00:02') == 316

    def test_seconds_minutes_hours(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_darkstat_html/3806_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_flic_last_seen_from_darkstat_html(html, '00:00:00:00:00:02') == 3806

    def test_empty_html(self):
        with pytest.raises(heartbeat.FlicNotFoundError):
            heartbeat.parse_flic_last_seen_from_darkstat_html('', '00:00:00:00:00:02')

    def test_never(self):
        with pytest.raises(heartbeat.FlicNotFoundError):
            with open(os.path.dirname(__file__) + '/test_files/sample_darkstat_html/never.html', 'r') as html_file:
                html = html_file.read()
                heartbeat.parse_flic_last_seen_from_darkstat_html(html, '00:00:00:00:00:02')
    
    def test_log_last_seen_when_darkstat_html_contains_flic_mac_address(self):
        file_path = os.path.dirname(__file__) + '/test_files/sample_darkstat_html/log_last_seen.html'
        with open(file_path, 'r') as html_file, patch('heartbeat.logging') as mock_logging:
            html = html_file.read()
            heartbeat.parse_flic_last_seen_from_darkstat_html(html, '00:00:00:00:00:02')

            mock_logging.info.assert_called_once_with('darkstat html contains flic last seen info:  <td><a href="./192.168.8.114/">192.168.8.114</a></td>  <td>flic</td>  <td><tt>00:00:00:00:00:02</tt></td>  <td class="num">1 hr, 3 mins, 26 secs</td></tr>')

class Test__parse_flic_ip_from_darkstat_html(object):

    def test_valid_input(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_darkstat_html/59_secs.html', 'r') as html_file:
            html = html_file.read()
            assert heartbeat.parse_flic_ip_from_darkstat_html(html, '00:00:00:00:00:02') == '192.168.8.114'

    def test_log_ip_when_darkstat_html_contains_flic_mac_address(self):
        file_path = os.path.dirname(__file__) + '/test_files/sample_darkstat_html/log_ip.html'
        with open(file_path, 'r') as html_file, patch('heartbeat.logging') as mock_logging:
            html = html_file.read()
            heartbeat.parse_flic_ip_from_darkstat_html(html, '00:00:00:00:00:02')

            mock_logging.info.assert_called_once_with('darkstat html contained flic IPv4 address:  <td><a href="./192.168.8.114/">192.168.8.114</a></td>  <td>flic</td>  <td><tt>00:00:00:00:00:02</tt></td>  <td class="num">1 hr, 3 mins, 26 secs</td></tr>')

class Test__parse_link_quality_from_iwconfig_output(object):

    def test_link_quality_1(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_iwconfig_output/link_quality_1.txt', 'r') as output_file, patch('heartbeat.logging') as mock_logging:
            iwconfig_output = output_file.read()
            heartbeat.parse_link_quality_from_iwconfig_output(iwconfig_output)
            mock_logging.info.assert_called_once_with('wlan0 link quality is %f', 1.0)

    def test_link_quality_half(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_iwconfig_output/link_quality_half.txt', 'r') as output_file, patch('heartbeat.logging') as mock_logging:
            iwconfig_output = output_file.read()
            heartbeat.parse_link_quality_from_iwconfig_output(iwconfig_output)
            mock_logging.info.assert_called_once_with('wlan0 link quality is %f', 0.5)

    def test_no_wlan0_in_output(self):
        with open(os.path.dirname(__file__) + '/test_files/sample_iwconfig_output/no_wlan0.txt', 'r') as output_file, patch('heartbeat.logging') as mock_logging:
            iwconfig_output = output_file.read()
            heartbeat.parse_link_quality_from_iwconfig_output(iwconfig_output)
            mock_logging.warning.assert_called_once_with('error parsing iwconfig output')

class Test__ping(object):

    def test_localhost(self):
        assert heartbeat.ping('localhost')

    def test_log_command(self):
        with patch('heartbeat.logging') as mock_logging:
            heartbeat.ping('localhost')
            mock_logging.info.assert_any_call('running: [\'ping\', \'-c\', \'1\', \'localhost\']')

    def test_log_when_successful(self):
        with patch('heartbeat.logging') as mock_logging:
            heartbeat.ping('localhost')
            mock_logging.info.assert_called_with('returned: 0')

    def test_log_when_errored(self):
        with patch('heartbeat.logging') as mock_logging:
            heartbeat.ping('invalid-ip')
            mock_logging.info.assert_called_with('returned: 2')

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
        with patch('http.client.HTTPSConnection') as MockHTTPSConnection:
            mock_connection = MockHTTPSConnection.return_value
            mock_response = unittest.mock.MagicMock()
            mock_response.status = 200
            mock_connection.getresponse.return_value = mock_response
            mock_connection.request = unittest.mock.MagicMock()

            system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
            flic_last_seen_secs = 5
            flic_last_ping_secs = 3
            success = heartbeat.send_heartbeat(flic_last_seen_secs, flic_last_ping_secs, system_id)

            assert success == True
            assert mock_connection.request.called

    def test_when_heartbeat_server_is_not_working(self):
        with patch('http.client.HTTPSConnection') as MockHTTPSConnection:
            mock_connection = MockHTTPSConnection.return_value
            mock_response = unittest.mock.MagicMock()
            mock_response.status = 500
            mock_connection.getresponse.return_value = mock_response
            mock_connection.request = unittest.mock.MagicMock()

            system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
            flic_last_seen_secs = 5
            flic_last_ping_secs = 3
            success = heartbeat.send_heartbeat(flic_last_seen_secs, flic_last_ping_secs, system_id)

            assert success == False
            assert mock_connection.request.called

    def test_when_request_times_out(self):
        with patch('http.client.HTTPSConnection') as MockHTTPSConnection:
            mock_connection = MockHTTPSConnection.return_value
            mock_connection.request = unittest.mock.MagicMock(side_effect=socket.timeout())

            system_id = 'b90e1fc0-53d3-42ba-8bf6-83453e6af744'
            flic_last_seen_secs = 5
            flic_last_ping_secs = 3
            success = heartbeat.send_heartbeat(flic_last_seen_secs, flic_last_ping_secs, system_id)

            assert success == False
            assert mock_connection.request.called

class Test__get_darkstat_html(object):

    def test_return_value(self):
        with patch('http.client.HTTPConnection') as MockHTTPConnection:
            mock_connection = MockHTTPConnection.return_value
            mock_response = unittest.mock.MagicMock()
            mock_connection.getresponse.return_value = mock_response
            test_html = '<html></html>'
            mock_response.read.return_value = test_html.encode('utf-8')

            assert test_html == heartbeat.get_darkstat_html()

    def test_when_request_times_out(self):
        with patch('http.client.HTTPConnection') as MockHTTPConnection:
            mock_connection = MockHTTPConnection.return_value
            mock_connection.request = unittest.mock.MagicMock(side_effect=socket.timeout())

            assert '' == heartbeat.get_darkstat_html()

class Test__run_loop_delay(object):

    def test_with_no_computation_time(self):
        last_run_time = datetime.datetime.now()
        with patch('time.sleep') as mock_sleep, patch('datetime.datetime') as mock_datetime:
            # fictional run loop computation takes 0 time
            mock_datetime.now.return_value = last_run_time
            heartbeat.run_loop_delay(1.0, last_run_time)
            mock_sleep.assert_called_once_with(1.0)

    def test_with_computation_time(self):
        last_run_time = datetime.datetime.now()
        with patch('time.sleep') as mock_sleep, patch('datetime.datetime') as mock_datetime:
            # simulate some computation that occurs before run_loop_delay() is called
            mock_datetime.now.return_value = last_run_time + datetime.timedelta(seconds=0.5)
            heartbeat.run_loop_delay(1.0, last_run_time)
            mock_sleep.assert_called_once_with(0.5)

    def test_with_computation_time_equal_to_min_delay(self):
        last_run_time = datetime.datetime.now()
        with patch('time.sleep') as mock_sleep, patch('datetime.datetime') as mock_datetime:
            # simulate some computation that takes exactly as long as the desired delay time
            mock_datetime.now.return_value = last_run_time + datetime.timedelta(seconds=1.0)
            heartbeat.run_loop_delay(1.0, last_run_time)
            mock_sleep.assert_called_once_with(0.0)

    def test_with_long_computation_time(self):
        last_run_time = datetime.datetime.now()
        with patch('time.sleep') as mock_sleep, patch('datetime.datetime') as mock_datetime:
            # simulate some long-running computation that occurs before run_loop_delay() is called
            mock_datetime.now.return_value = last_run_time + datetime.timedelta(seconds=10.0)
            heartbeat.run_loop_delay(1.0, last_run_time)
            mock_sleep.assert_called_once_with(0.0)
