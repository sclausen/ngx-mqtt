<a name="1.10.0"></a>
## [1.10.0](https://github.com/sclausen/ngx-mqtt/compare/1.0.9...1.10.0) (2017-05-19)


### Features

* **service:** throw an error, if the the suback contains a rejection ([#22](https://github.com/sclausen/ngx-mqtt/issues/22)) ([683ebdd](https://github.com/sclausen/ngx-mqtt/commit/683ebdd))

### BREAKING CHANGES

* Previously, observing and then subscribing to a topic, which causes the actual MQTT subscription, wouldn't throw an error, if the subscription got rejected. Now, an Error will be thrown, which **must** be caught.

``` ts
  this.mqtt
    .observe('forbidden/filter')
    .subscribe((msg: MqttMessage) => {
      // handle message
    }, (e) => {
      // error callback
    })
```