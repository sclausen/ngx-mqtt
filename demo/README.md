## Prequisites
You need a running mqtt broker with websocket support under port 9001.
The easies way IMHO is [mosquitto](https://mosquitto.org/).
My mosquitto.conf with websockets enabled looks as follows

```
pid_file /var/run/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

listener 1883

listener 9001 127.0.0.1
protocol websockets

include_dir /etc/mosquitto/conf.d
```