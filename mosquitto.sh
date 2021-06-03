#/bin/sh
docker run -it --name mosquitto --rm -p 9001:9001 -v $(pwd)/mosquitto:/mosquitto/ eclipse-mosquitto
