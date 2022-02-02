#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

# Install the dependencies
rm -rf package
pip3 install --target ./package requests==2.27.1

# Create a zip file of the dependencies
cd package
zip -r ../buttons-lambda.zip .
cd ..

# Add the source code to the zip file
cd src
zip -g ../buttons-lambda.zip *
cd ..

# Return to original directory
cd $original_dir