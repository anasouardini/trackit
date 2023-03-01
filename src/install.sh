#!/usr/bin/env bash

binPath=/usr/bin

sudo cp trackitClient.js $binPath/trackit
sudo chmod +x $binPath/trackitClient

sudo cp trackitServer.js $binPath/trackitServer
sudo chmod +x $binPath/trackitServer
