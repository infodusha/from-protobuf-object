# from-protobuf-object
fromObject method for grpc-web

In general that is opposite for 'toObject' method in protobufjs.

### Supports:
* Simple keys
* Repeated
* OneOf
* Protobuf Map
* Recursive messages
* Type validation (at runtime)
* TypeScript
* Missing keys validation

## Installation
`npm i from-protobuf-object`

## Usage
```typescript
import { fromProtobufObject } from 'from-protobuf-object';
import { MyMessage } from './my-message_pb';

const myMessage = fromProtobufObject(MyMessage, {
    keyOne: 1,
    keyTwo: 'foo',
    keyThree: {
        keyA: 2,
        keyB: 'bar',
    },
});
```

## Contributing
Contributions are always welcome!

## License
[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
