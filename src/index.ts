import { BinaryReader, Message, Map as ProtobufMap } from "google-protobuf";

type MessageConstructor<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type FakeReaderValue = Message | ProtobufMap<unknown, unknown>;

interface FakeReaderRef {
    current?: FakeReaderValue;
}

const enum PREFIX {
    SET = 'set',
    GET = 'get',
    CLEAR = 'clear',
}

export function fromProtobufObject<T extends Message>(MessageType: MessageConstructor<T>, data: AsObject<T>): T {
    const instance = new MessageType();
    validateMissingProps(instance, data);
    for (const [key, value] of Object.entries(filterExtraProps(instance, data))) {
        const prop = getActualKey(key);
        if (Array.isArray(value) && isProtobufMap(instance, prop)) {
            const mapMethod = getMethod(prop, PREFIX.GET);
            const map = callMethod(instance, mapMethod) as ProtobufMap<unknown, unknown>;
            const NestedType = retrieveNestedMapType(instance, prop);
            for (const [k, v] of value) {
                if(!isObject(v, prop)) {
                    map.set(k, v);
                    continue;
                }
                if (!NestedType) {
                    throw new Error('Unable to retrieve nested type');
                }
                map.set(k, fromProtobufObject(NestedType, v));
            }
            continue;
        }
        const result = getResult(instance, prop, value);
        validateType(instance, prop, value);
        const setter = getMethod(prop, PREFIX.SET);
        callMethod(instance, setter, result);
    }
    return instance;
}

function getResult<T extends Message>(instance: T, prop: string, value: unknown): unknown {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length === 0 || !isArrayOfObjects(value, prop)) {
            return value;
        }
        const NestedType = retrieveNestedType(instance, prop);
        return value.map((child) => fromProtobufObject(NestedType, child));
    }
    if (isObject(value, prop)) {
        const NestedType = retrieveNestedType(instance, prop);
        return fromProtobufObject(NestedType, value as object);
    }
    return value;
}

function callMethod<T extends object, R>(obj: T, key: string, value?: unknown): R {
    return (obj[key as keyof T] as (value: unknown) => R)(value);
}

function getActualKey(key: string): string {
    return key === 'pb_default' ? 'default' : key;
}

function getProp(key: string, prefix: PREFIX): string {
    const prop = getActualKey(key).slice(prefix.length);
    return prop.slice(0, 1).toLowerCase() + prop.slice(1);
}

function getMethod(prop: string, prefix: PREFIX): string {
    return `${prefix}${prop[0].toUpperCase()}${prop.slice(1)}`;
}

function getInstancePropsFromKeys(keys: string[], prefix: PREFIX): string[] {
    return keys
        .filter((key) => key.startsWith(prefix))
        .map(key => getProp(key, prefix));
}

function getInstanceProps<T extends Message>(instance: T): string[] {
    const keys = Object.keys(Object.getPrototypeOf(instance));
    const setters = getInstancePropsFromKeys(keys, PREFIX.SET);
    const maps = getInstancePropsFromKeys(keys, PREFIX.CLEAR).filter(prop => isProtobufMap(instance, prop));
    return [...setters, ...maps];
}

function isProtobufMap<T extends Message>(instance: T, prop: string): boolean {
    return callMethod(instance, getMethod(prop, PREFIX.GET)) instanceof ProtobufMap;
}

function isOptional<T extends Message>(instance: T, prop: string): boolean {
    const clearMethod = getMethod(prop, PREFIX.CLEAR);
    return clearMethod in instance;
}

function validateMissingProps<T extends Message>(instance: T, data: AsObject<T>): void {
    const instanceProps = getInstanceProps(instance);
    const dataKeys = Object.keys(data).map(getActualKey);
    for (const prop of instanceProps) {
        if (!dataKeys.includes(prop) && !isOptional(instance, prop)) {
            throw new Error(`Missing property '${prop}'`);
        }
    }
}

function filterExtraProps<T extends Message>(instance: T, data: AsObject<T>): AsObject<T> {
    const instanceProps = getInstanceProps(instance);
    return Object.fromEntries(Object.entries(data).filter(([key, value]) => instanceProps.includes(getActualKey(key)) && value !== undefined)) as AsObject<T>;
}

function isObject(value: unknown, prop: string): boolean {
    if (value === null) {
        throw new Error(`Null value for key '${prop}'`);
    }
    return typeof value === 'object';
}

function isArrayOfObjects(arr: unknown[], prop: string): boolean {
    if (arr.every((item) => isObject(item, prop))) {
        return true;
    }
    if (arr.every((item) => !isObject(item, prop))) {
        return false;
    }
    throw new Error(`Mixed array for '${prop}'`);
}

function validateType<T extends Message>(instance: T, prop: string, value: unknown): void {
    const getter = getMethod(prop, PREFIX.GET);
    const instanceValue = callMethod(instance, getter);
    const expectedType = instanceValue !== undefined ? typeof instanceValue : 'object';
    const actualType = value instanceof Uint8Array ? 'string' : typeof value;
    if (Array.isArray(instanceValue) && !Array.isArray(value)) {
        throw new Error(`Invalid type for '${prop}' (expected array, got '${actualType}')`);
    }
    if (!Array.isArray(instanceValue) && Array.isArray(value)) {
        throw new Error(`Invalid type for '${prop}' (expected '${expectedType}', got array)`);
    }
    if (expectedType !== actualType) {
        throw new Error(`Invalid type for '${prop}' (expected '${expectedType}', got '${actualType}')`);
    }
}

function getFieldNumber<T extends Message>(instance: T, prop: string): number {
    const Ctor = instance.constructor as MessageConstructor<T>;
    const i = new Ctor();
    
    let fieldNumber = -1;
    const trackNumericKey = (key: PropertyKey) => {
        if (fieldNumber === -1 && typeof key === 'string') {
            const num = Number(key);
            if (!isNaN(num)) fieldNumber = num;
        }
    };
    
    const handler: ProxyHandler<object> = {
        get(target, key) {
            trackNumericKey(key);
            const record = target as Record<PropertyKey, unknown>;
            let value = record[key];
            if (value === undefined && typeof key === 'string') {
                record[key] = {};
                value = record[key];
            }
            return typeof value === 'object' && value !== null 
                ? new Proxy(value, handler) 
                : value;
        },
        has(target, key) {
            trackNumericKey(key);
            return key in target;
        },
    };
    
    const proxy = new Proxy(i, handler) as T;
    callMethod(proxy, getMethod(prop, PREFIX.GET));
    return fieldNumber;
}

function makeFakeReader(fieldNumber: number) {
  const ref: FakeReaderRef = {};
  const reader = {
    nextField() {
        return !ref.current;
    },
    isEndGroup() {
        return false;
    },
    getFieldNumber() {
        return fieldNumber;
    },
    readMessage(msg: FakeReaderValue) {
        ref.current = msg;
    },
    skipField() {},
  } satisfies Partial<BinaryReader> as unknown as BinaryReader;

  return [reader, ref] as const;
}

function retrieveNestedType<T extends Message, N extends Message>(instance: T, prop: string): MessageConstructor<N> {
    const fieldNumber = getFieldNumber(instance, prop);
    const [reader, ref] = makeFakeReader(fieldNumber);
    const Ctor = instance.constructor as typeof Message;
    Ctor.deserializeBinaryFromReader(instance, reader);
    if (!ref.current) {
        throw new Error('Unable to retrieve nested type');
    }
    return ref.current.constructor as MessageConstructor<N>;
}

function retrieveNestedMapType<T extends Message, N extends Message>(instance: T, prop: string): MessageConstructor<N> | null {
    const fieldNumber = getFieldNumber(instance, prop);
    const [reader, ref] = makeFakeReader(fieldNumber);
    const Ctor = instance.constructor as typeof Message;
    Ctor.deserializeBinaryFromReader(instance, reader);
    if (!ref.current) {
        throw new Error('Unable to retrieve nested map type');
    }
    const mapInstance = ref.current as ProtobufMap<unknown, unknown>;

    const mapObj = mapInstance as unknown as Record<string, unknown>;
    for (const key of Object.keys(mapObj)) {
        const value = mapObj[key];
        if (typeof value === 'function' && value.prototype instanceof Message) {
            return value as MessageConstructor<N>;
        }
    }
    
    return null;
}
