import { fromProtobufObject } from "../src";
import { BookStore } from "./test-data/generated/book-store_pb";
import { PhoneShop } from "./test-data/generated/phone-shop_pb";
import { Forest } from "./test-data/generated/forest_pb";
import { Universe } from "./test-data/generated/universe_pb";
import { Spices } from "./test-data/generated/spices_pb";
import { Newspaper } from "./test-data/generated/newspaper_pb";
import { File } from "./test-data/generated/file_pb";
import { Edge } from "./test-data/generated/edge_pb";

describe('fromProtobufObject', () => {
    it('Should work with easy structure', () => {
        const obj = {
            name: 'Harry Potter',
            shelf: 3,
        } satisfies BookStore.AsObject;
        const bookStore = fromProtobufObject(BookStore, obj);
        expect(bookStore.toObject()).toEqual(obj);
    });

    it('Should work with nested structure', () => {
        const obj = {
            id: 1,
            phone: {
                model: 'iPhone 11',
                diagonal: 6,
                price: 999,
                company: {
                    name: 'Apple',
                    country: 'USA',
                },
            },
        } satisfies PhoneShop.AsObject;
        const phoneShop = fromProtobufObject(PhoneShop, obj);
        expect(phoneShop.toObject()).toEqual(obj);
    });

    it('Should ignore extra params', () => {
        const planetsList = ['Earth', 'Mars', 'Venus'];
        const obj = {
            planetsList,
            extra: 'data',
        } as Universe.AsObject;
        const universe = fromProtobufObject(Universe, obj);
        expect(universe.toObject()).toEqual({ planetsList } satisfies Universe.AsObject);
    });

    it('Should throw when lack of params', () => {
        const obj = {
            name: 'Esperanto',
        } as BookStore.AsObject;
        expect(() =>  fromProtobufObject(BookStore, obj)).toThrowError(`Missing property 'shelf'`);
    });

    it('Should not throw when lack of array params', () => {
        const obj = {} as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).not.toThrowError(`Missing property 'planetsList'`);
        expect(() => fromProtobufObject(Universe, obj)).not.toThrow();
    });

    it('Should throw when null value', () => {
        const obj = {
            planetsList: null,
        } as unknown as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).toThrowError(`Null value for key 'planetsList'`);
    });

    it('Should not throw when extra null value', () => {
        const obj = {
            planetsList: ['Saturn'],
            extra: null,
        } as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).not.toThrowError(`Null value for key 'extra'`);
        expect(() => fromProtobufObject(Universe, obj)).not.toThrow();
    });
});

describe('Oneof rule', () => {
    it('Should work with oneof rule', () => {
        const objNews = {
            id: 1,
            name: 'The New York Times',
            isAds: true,
            isNews: true,
            contentByPageMap: [],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;
        const objAds = {
            id: 2,
            name: 'RBK',
            isNews: true,
            isAds: true,
            contentByPageMap: [],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;
        const newspaperNews = fromProtobufObject(Newspaper, objNews);
        const newspaperAds = fromProtobufObject(Newspaper, objAds);
        expect(newspaperNews.toObject()).toEqual({ ...objNews, isAds: false });
        expect(newspaperAds.toObject()).toEqual({ ...objAds, isNews: false });
    });
});

describe('Validation', () => {
    it('Should validate simple type', () => {
        const obj = {
            name: 'Harry Potter',
            shelf: 'second',
        } as unknown as BookStore.AsObject;
        expect(() => fromProtobufObject(BookStore, obj)).toThrowError(`Invalid type for 'shelf' (expected 'number', got 'string')`);
    });

    it('Should validate nested structure', () => {
        const obj = {
            id: 1,
            phone: 123,
        } as unknown as PhoneShop.AsObject;
        expect(() => fromProtobufObject(PhoneShop, obj)).toThrowError(`Invalid type for 'phone' (expected 'object', got 'number')`);
    });

    it('Should not throw on undefined objects', () => {
        const obj = {
            id: 1,
            phone: undefined,
        } satisfies PhoneShop.AsObject;
        expect(() => fromProtobufObject(PhoneShop, obj)).not.toThrow();
    });

    it('Should validate simple array', () => {
        const obj = {
            planetsList: true,
        } as unknown as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).toThrowError(`Invalid type for 'planetsList' (expected array, got 'boolean')`);
    });

    it('Should validate simple false array', () => {
        const obj = {
            name: 'Gary Garrison',
            shelf: [4, 2],
        } as unknown as BookStore.AsObject;
        expect(() => fromProtobufObject(BookStore, obj)).toThrowError(`Invalid type for 'shelf' (expected 'number', got array)`);
    });
});

describe('Repeated rule', () => {
    it('Should work with simple array', () => {
        const obj = {
            planetsList: ['Earth', 'Mars', 'Venus'],
        } satisfies Universe.AsObject;
        const universe = fromProtobufObject(Universe, obj);
        expect(universe.toObject()).toEqual(obj);
    });

    it('Should work with empty array', () => {
        const obj = {
            planetsList: [],
        } satisfies Universe.AsObject;
        const universe = fromProtobufObject(Universe, obj);
        expect(universe.toObject()).toEqual(obj);
    });


    it('Should work with array structure', () => {
        const obj = {
            treesList: [
                { age: 1, height: 10 },
                { age: 5, height: 42 },
            ],
            info: {
                name: 'Forest',
                numberOfTrees: 4000,
            },
        } satisfies Forest.AsObject;
        const forest = fromProtobufObject(Forest, obj);
        expect(forest.toObject()).toEqual(obj);
    });

    it('Should throw when null in array', () => {
        const obj = {
            planetsList: [null],
        } as unknown as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).toThrowError(`Null value for key 'planetsList'`);
    });

    it('Should throw when mixed array', () => {
        const obj = {
            planetsList: ['Saturn', {}],
        } as Universe.AsObject;
        expect(() => fromProtobufObject(Universe, obj)).toThrowError(`Mixed array for 'planetsList'`);
    });
});

describe('Recursive messages', () => {
    it('Should work with recursive', () => {
        const obj = {
            name: 'Pork',
            mixed: {
                spicesList: [
                    { name: 'Pepper' },
                    {
                        name: 'Salt',
                        mixed: {
                            spicesList: [{
                                name: 'Dark',
                                mixed: { spicesList: [{ name: 'Void' }] },
                            }],
                        },
                    },
                ],
            },
        } satisfies Spices.AsObject;
        const spices = fromProtobufObject(Spices, obj);
        expect(spices.toObject()).toEqual(obj);
    });
});

describe('Map rule', () => {
    it('Should work with simple map', () => {
        const obj = {
            id: 1,
            name: 'The New York Times',
            isAds: false,
            isNews: true,
            contentByPageMap: [
                [1, 'fist page'],
                [2, 'second page'],
            ],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;

        const newspaper = fromProtobufObject(Newspaper, obj);
        expect(newspaper.toObject()).toEqual(obj);
    });

    it('Should work with nested type', () => {
        const obj = {
            id: 1,
            name: 'The New York Times',
            isAds: false,
            isNews: true,
            contentByPageMap: [],
            adsByPageMap: [
                [1, { data: 'Google' }],
                [2, { data: 'Facebook' }],
            ],
        } satisfies Newspaper.AsObject;

        const newspaper = fromProtobufObject(Newspaper, obj);
        expect(newspaper.toObject()).toEqual(obj);
    });
});

describe('Binary data', () => {
    it('Should work with Uint8Array', () => {
        const obj = {
            name: 'index.pdf',
            data: new Uint8Array([1, 3, 4]),
        } satisfies File.AsObject;
        const expected = new File();
        expected.setName(obj.name);
        expected.setData(obj.data);
        const file = fromProtobufObject(File, obj);
        expect(file).toEqual(expected);
    });


    it('Should work with string', () => {
        const obj = {
            name: 'index.pdf',
            data: 'teeeeestttt',
        } satisfies File.AsObject;
        const file = fromProtobufObject(File, obj);
        expect(file.toObject()).toEqual(obj);
    });
});

describe("Edge cases", () => {
  it("Should work with  default property", () => {
    const obj = {
      pb_default: true,
    } satisfies Edge.AsObject;
    const file = fromProtobufObject(Edge, obj);
    expect(file.toObject()).toEqual(obj);
  });
});
