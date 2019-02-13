[![Build Status](https://travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveButtons)

to set up the network monitor on a raspberry pi, follow these steps:

- format the SD card
- use Etcher to flash the SD card with Raspbian Stretch
- create a file named `ssh` in the boot partition of the SD card
- install the SD card into the raspberry pi, connect it to power and ethernet
- ssh into the raspberry pi, clone this repository, and run `sudo pi/setup_pi.sh`

to run tests for the raspberry pi code:

- install pytest and pytest-cov (using pip)
- `cd` into the `pi` directory
- run `pytest --cov=heartbeat`

System Overview at https://docs.google.com/document/d/1DO__ZLYM44_8M6uKUR330mqqvwhhyw8_-WYOdjJLE4I/edit?usp=sharing
