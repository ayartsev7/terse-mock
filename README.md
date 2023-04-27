# JS/TS Tests in a Couple of Lines

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![coverage](./badges/coverage-jest%20coverage.svg)

The goal of this project is to make it easier to create mocks and stubs and to reduce the amount of code when writing tests in general.

## Install
npm ([terse-mock on npm](https://www.npmjs.com/package/terse-mock)):

```bash
npm install --save-dev terse-mock
```
yarn

```bash
yarn add --dev terse-mock 
```
## Introduction
terse-mock is intended to use as an addition to existing test frameworks such as [Jest](https://jestjs.io/).  
The module mainly contains functions for creating and managing mocks/stubs and getting statistics on mocks usage. The most useful of them are:  

<table style="line-height:0.7em">
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed;">tmock</td>
    <td style="border: none;">creates mock</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tstub</td>
    <td>creates stub</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tset</td>
    <td>supplements mock or stub</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">treset</td>
    <td>clears mock touches, mock calls and mock values set by sut</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tunmock</td>
    <td>removes mocks from data</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tcalls</td>
    <td>returns call history of mock functions</td>
  </tr>
</table>

terse-mock is covered and tested with Jest so Jest tests will be used in examples below.
### Typical usage
```javascript
import { tmock } from 'terse-mock';

test('some test', () => {
  // ARRANGE
  const mock = tmock('name', [ // create mock
    [m => m.f('some value').data.val, 7], // setup return values
  ]);

  // ACT
  const res = tunmock(sut(mock)); // pass mock to system under test, unmock result

  // ASSERT
  expect(res).toEqual(expectedRes); // check expectations
}
```
Unmocking is required to turn result into plain js type before checking expectations.
## Features
- [Deep automocking](#deep-automocking)
- [Easy setting mock values](#easy-setting-mock-values)
- [Stubs](#stubs)
- [Creating functions that return different values per set of arguments](#creating-functions-that-return-different-values-per-set-of-arguments)
- [Interface mocks](#interface-mocks)
- [Call history](#call-history)
- [Automatic spies](#automatic-spies)
- [Using external mocks](#using-external-mocks)
- [Module mocks](#module-mocks)
- [Resetting mocks](#resetting-mocks)
- [And more](#and-more)
  - [Alternative way of setting mock values](#alternative-way-of-setting-mock-values)
  - [Import all at once](#import-all-at-once)
  - [Nested mocks](#nested-mocks)
  - [Сall history display options](#call-history-display-options)
  - [Global module options](#global-module-options)

## Deep automocking
By default mocks allows to access properties and call functions at any nesting level without first initializing the return values.

Suppose we have [SUT](https://en.wikipedia.org/wiki/System_under_test):
```javascript
function sut(data) {
  const r1 = data.getSomething(true).doSomething();
  const r2 = r1.property === 1 ? data.getSomethingElse('a') : null;
  const r3 = data.getSomethingElse('b', true);
  r3.value = 7;

  return {
    prop1: r1.property,
    prop2: r2,
    prop3: r3,
  };
}
```
The shortest test could be like:
```javascript
test('shortest test demo', () => {
  // ARRANGE
  const mock = tmock('data');

  // ACT
  const res = tunmock(sut(mock));

  // ASSERT
  expect(res).toEqual({
    prop1: 'data.getSomething(true).doSomething().property',
    prop2: null,
    prop3: {
      value: 7,
    },
  });
});
```
```
Test Suites: 1 passed, 1 total
```
## Easy setting mock values
For the SUT defined [above](#deep-automocking) make mock return different values for property so we could test all code paths:
```javascript
test.each([
  [1, 'something else'],
  [0, null],
])('should return something else in prop2 when property is 1 otherwise null', (property, expectedResult) => {
  // ARRANGE
  const mock = tmock([
    [m => m.getSomething(true).doSomething().property, property],
    [m => m.getSomethingElse('a'), 'something else'],
  ]);

  // ACT
  const res = tunmock(sut(mock));

  // ASSERT
  expect(res.prop2).toEqual(expectedResult);
});
```
## Stubs
If one need neither automocking nor checking function calls then it worth using stubs rather then mocks. terse-mock stubs are plain js objects, fast and straightford.
```javascript
test('stub demo', () => {
  // ARRANGE
  const stub = tstub([
    [s => s.a.aa, 0],
    [s => s.f(), 'result'],
    [s => s.b, { bb: 1 }],
  ]);

  // ASSERT
  expect(stub).toEqual({
    a: { aa: 0 },
    f: expect.any(Function),
    b: { bb: 1 },
  });
  expect(stub.f()).toEqual('result');
});
```
## Creating functions that return different values per set of arguments
```javascript
test('function that return different values per set of arguments demo', () => {
  // ARRANGE
  const f = tstub([
    [s => s(TM_ANY), 0],
    [s => s(), 1],
    [s => s('a'), 2],
    [s => s('b'), 3],
    [s => s('b', true), 4],
  ]);

  // ASSERT
  expect(f('something')).toEqual(0);
  expect(f()).toEqual(1);
  expect(f('a')).toEqual(2);
  expect(f('b')).toEqual(3);
  expect(f('b', true)).toEqual(4);
});
```
## Interface mocks
Generic form of `tmock`/`tstub` is available if one wants to use benefits like static type checking and code completion  

![Static type checking and code completion](../media/static-type-check.jpg?raw=true)
## Call history
The module keeps mocked functions call history. The test below demonstrates how one could check call order and arguments passed to mocked functions for SUT from [above](#deep-automocking):
```javascript
test('check calls demo', () => {
  // ARRANGE
  const mock = tmock('data', [
    [m => m.getSomething(true).doSomething().property, 1],
  ]);

  // ACT
  tunmock(sut(mock));

  // ASSERT
  expect(tcalls(mock)).toEqual([ // all calls
    'data.getSomething(true)',
    'data.getSomething(true).doSomething()',
    'data.getSomethingElse("a")',
    'data.getSomethingElse("b", true)',
  ]);
  expect(tcalls(mock.getSomethingElse)).toEqual([ // calls to getSomethingElse
    'data.getSomethingElse("a")',
    'data.getSomethingElse("b", true)',
  ]);
});
```
## Automatic spies
The module automatically creates spies for functions from mock return values added by `tmock` and `tset` (except functions from return values of other functions). Calls to spied functions get to result of `tcalls` and can be analyzed with `tinfo`.
```javascript
test('automatic spies demo', () => {
  // ARRANGE
  const obj = {
    nestedObj: {
      f: function (n) { return n > 7 },
    },
  };
  const mock = tmock([
    [m => m.obj, obj],
  ]);

  // ASSERT
  expect(mock.obj.nestedObj.f(7)).toBe(false);
  expect(mock.obj.nestedObj.f(8)).toBe(true);
  expect(tcalls(mock)).toEqual([
    'mock.obj.nestedObj.f(7)',
    'mock.obj.nestedObj.f(8)'
  ])
});
```
## Using external mocks
terse-mock can use external mocks to analyze calls to mocked functions. To do so one need to create adapter for external mock by implementing `IExternalMock` interface provided by the module and pass the adapter to `tmock`. The test demonstrates how to use Jest mocks for call analyzing:
```javascript
const jestMock: IExternalMock = {
  create: () => jest.fn(),
};

test('can use external mocks to analyze calls to mocked functions', () => {
  // ARRANGE
  const mock = tmock({ externalMock: jestMock });

  // ACT
  mock.f(7);

  // ASSERT
  const unmockedMock = tunmock(mock);
  const externalMockForF = tinfo(unmockedMock.f).externalMock;
  expect(externalMockForF).toBeCalledTimes(1);
  expect(externalMockForF).toBeCalledWith(7);
});
```
Also external mocks can be used as return values for terse-mock mocks:
```javascript
test('can use external mock as return value', () => {
  // ARRANGE
  const jestFn = jest.fn();
  const mock = tmock([{ f: jestFn }]);

  // ACT
  mock.f();

  // ASSERT
  expect(mock.f).toBeCalledTimes(1);
});
```
## Module mocks
terse-mock mocks can be used as return values from [Jest module factory for jest.mock()](https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter)  
Please note that the example below uses an [alternative way](#alternative-way-of-setting-mock-values) of setting mock values, as it is well suited for such cases.
```javascript
import { tmock } from '../src/terse-mock';
jest.mock('some-module', () => tmock('some-module');
jest.mock('some-other-module', () => tmock('some-other-module', [{
  someFunction: () => 'some value',
}]));
```
## Resetting mocks
Mock or any of its part can be reset by `treset`. That means that all mock touches, mock calls and mock values setup outside `tmock` and `tset` are cleared out from mock while values setup by `tmock` and `tset` persist. Calling `treset` with mock argument will also reset all nested mocks passed to `tmock` and `tset` as return values for this mock.
```javascript
test('reset mocks demo', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.p.pp, 'val'],
  ]);

  // Oparate mock in sut.
  mock.p = {}; // Replace value.
  mock.a.f().c = true; // Add new value.
  mock.b; // Touch.
  expect(tunmock(mock)).toEqual({ // Unmock to observe all mock values at once
    p: {},
    a: {
      f: expect.any(Function),
    },
    b: 'mock.b',
  });

  // ACT
  treset(mock);

  // ASSERT
  expect(tunmock(mock)).toEqual({
    p: {
      pp: 'val',
    },
  });
});
```
## And more
Some of minor features are listed below. See project [tests](https://github.com/ayartsev7/terse-mock/tree/main/tests) for the rest of features and examples.
### Alternative way of setting mock values
Besides setup tuples there is another way of passing mock return values: initialization object. This option is well suited for [module mocks](#module-mocks)
```javascript
test('two ways of setting mock values', () => {
  // ARRANGE
  const stub = tstub([
    { // with object
      a: 'value for a', // equivalent to tuple [s => s.a, 'value for a']
    },
    [s => s.b, 'value for b'], // with tuple
    [s => s.c, 'value for c'], // with tuple
  ]);

  // ASSERT
  expect(stub).toEqual({
    a: 'value for a',
    b: 'value for b',
    c: 'value for c',
  });
});
```
### Import all at once
Module has default export with all module functions and constants.  
Instead of
```javascript
import { tmock, TM_ANY } from 'terse-mock';

const mock = tmock([[m => m.f(TM_ANY), 1]]);
```
one can write
```javascript
import tm from 'terse-mock';

const mock = tm.mock([[m => m.f(tm.ANY), 1]]);
```
### Nested mocks
terse-mock mocks can be freely used as mock return values of `tmock` and `tset`
```javascript
test('nested mocks demo', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.nestedMock, tmock([
      [mm => mm.prop1, 1],
      [mm => mm.prop2, 3],
    ])],
    [m => m.prop, 'val'],
  ]);
  mock.nestedMock.anotherProp = 5;

  // ASSERT
  expect(mock.nestedMock.prop1).toBe(1);
  expect(mock.nestedMock.prop2).toBe(3);
  expect(mock.nestedMock.anotherProp).toBe(5);
  expect(tunmock(mock)).toEqual({
    nestedMock: {
      prop1: 1,
      prop2: 3,
      anotherProp: 5,
    },
    prop: 'val',
  });
```
### Call history display options
By default `tcalls` uses simplified output - it does not expose the contents of objects and arrays in called functions arguments. If you need to see the contents of objects and arrays, you can use the `simplifiedOutputEnabled` option, which can be set both globally and for a specific mock.
```javascript
test('simplified output enabled/disabled demo', () => {
  // ARRANGE
  const mockSimplified = tmock();
  const mock = tmock({ simplifiedOutputEnabled: false });

  // ACT
  mockSimplified.f(
    1,
    { a: 1, b: 2, c: 3 },
    [1, 2, 3]
  );
  mock.f(
    1,
    { a: 1, b: 2, c: 3 },
    [1, 2, 3],
  );

  // ASSERT
  expect(tcalls(mockSimplified)[0]).toBe('mock.f(1, {...}, [...])');
  expect(tcalls(mock)[0]).toBe('mock.f(1, {a: 1, b: 2, c: 3}, [1, 2, 3])');
});
```
### Global module options
`tglobalopt` allows to customise global module settings e.g. set default name for mocks or turn simplified output on/of
```javascript
test('global module options', () => {
  // ARRANGE
  tglobalopt({
    defaultMockName: 'newName',
  })
  const mock = tmock();

  // ACT
  const res = tunmock(mock.a);

  // ASSERT
  expect(res).toBe('newName.a');
});
```