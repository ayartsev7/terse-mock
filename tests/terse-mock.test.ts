﻿import tm, { TM_ANY, tset, treset, tmock, tunmock, tinfo, tglobalopt, IExternalMock, TOpt, tstub, TInit, tlocalopt } from '../src/terse-mock';

const jestMock: IExternalMock = {
  create: () => jest.fn(),
};

const SCALARS = [
  0,
  1,
  -1,
  1e-1,
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
  undefined,
  null,
  '',
  'a b',
  Symbol(),
  Symbol('a'),
];

const DFAULT_NUMERIC_VALUE = 1;

const FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE = [
  () => DFAULT_NUMERIC_VALUE,
  (a: any, b: any) => DFAULT_NUMERIC_VALUE, // eslint-disable-line @typescript-eslint/no-unused-vars
  function f() { return DFAULT_NUMERIC_VALUE; },
  function () { return DFAULT_NUMERIC_VALUE; },
  new Function(`return ${DFAULT_NUMERIC_VALUE}`),
  //jest.fn(() => DFAULT_NUMERIC_VALUE),
];

const testSymbol = Symbol('testSymbol');
const objectWithTestSymbolProperty = {};
objectWithTestSymbolProperty[testSymbol] = DFAULT_NUMERIC_VALUE;
const objectWithoutPrototypeWithProperty = Object.create(null);
objectWithoutPrototypeWithProperty.a = DFAULT_NUMERIC_VALUE;

const OBJECTS_CLASSES_ARRAYS = [
  objectWithTestSymbolProperty,
  Object.create(null),
  objectWithoutPrototypeWithProperty,
  {},
  { a: [1, 2, 3] },
  [],
  [{}, 7, { a: 1 }],
  /a/,
];

const globalOptBackup = tglobalopt();

beforeEach(() => {
  tglobalopt(globalOptBackup);
  treset();
});

test('should all exported functions have analogues in tm', () => {
  // ASSERT
  expect(tm.ANY).toBe(TM_ANY);
  expect(tm.set).toBe(tset);
  expect(tm.reset).toBe(treset);
  expect(tm.mock).toBe(tmock);
  expect(tm.stub).toBe(tstub);
  expect(tm.unmock).toBe(tunmock);
  expect(tm.info).toBe(tinfo);
  expect(tm.globalopt).toBe(tglobalopt);
  expect(tm.localopt).toBe(tlocalopt);
});

describe('-------------------- tglobalopt ----------------------', () => {
  test('should return default options when options have not been changed until now', () => {
    // ACT
    const globalOptions = tglobalopt();

    // ASSERT
    const expectedGlobalOpt: TOpt = {
      defaultMockName: '<mock>',
      collapseThreshold: 40,
      collapseLongValues: true,
      automock: true,
      quoteSymbol: '\'',
      exposeFunctionNames: false,
      autoValuesPrefix: '',
    };
    expect(globalOptions).toEqual(expectedGlobalOpt);
  });

  test('should override and merge options', () => {
    // ARRANGE
    tglobalopt({
      automock: true,
      quoteSymbol: '"',
    });

    // ACT
    const globalOpt = tglobalopt({
      automock: false,
      defaultMockName: 'mock name',
      collapseThreshold: 1,
      collapseLongValues: false,
      // quoteSymbol: // not provided
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    });

    // ASSERT
    const expectedGlobalOpt: TOpt = {
      defaultMockName: 'mock name',
      collapseThreshold: 1,
      collapseLongValues: false,
      automock: false,
      quoteSymbol: '"',  // has default value
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    }
    expect(globalOpt).toEqual(expectedGlobalOpt);
  });

  test('should not affect local options', () => {
    // ARRANGE
    tlocalopt({ defaultMockName: 'aaa' });

    // ACT
    tglobalopt({ defaultMockName: 'bbb' });

    // ASSERT
    expect(tlocalopt().defaultMockName).toBe('aaa');
  });
});

describe('-------------------- tlocalopt ----------------------', () => {
  test('should return default options when options have not been changed until now', () => {
    // ACT
    const localOpt = tlocalopt();

    // ASSERT
    expect(localOpt).toEqual({});
  });

  test('should override and merge options', () => {
    // ARRANGE
    tlocalopt({
      automock: true,
      defaultMockName: 'mock name',
    });

    // ACT
    const localOpt = tlocalopt({
      // automock: // not provided
      defaultMockName: 'overriden mock name',
      collapseThreshold: 1,
      collapseLongValues: false,
      quoteSymbol: '"',
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    });

    // ASSERT
    const expectedLocalOpt: TOpt = {
      automock: true,
      defaultMockName: 'overriden mock name',
      collapseThreshold: 1,
      collapseLongValues: false,
      quoteSymbol: '"',
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    };
    expect(localOpt).toEqual(expectedLocalOpt);
  });

  test('should be erased by treset', () => {
    // ARRANGE
    tlocalopt({ defaultMockName: 'aaa' });

    // ACT
    treset();

    // ASSERT
    expect(tlocalopt()).toEqual({});
  });

  test('should not affect global options', () => {
    // ARRANGE
    tglobalopt({ defaultMockName: 'aaa' });

    // ACT
    tlocalopt({ defaultMockName: 'bbb' });

    // ASSERT
    expect(tglobalopt().defaultMockName).toBe('aaa');
  });
});

describe('----------------------- options ------------------------', () => {
  describe('automock', () => {
    test('should return proxy when automock enabled for not explicitly mocked', () => {
      // ACT
      tlocalopt({ automock: true });
      const mock = tmock();

      // ASSERT
      expect(typeof mock.a).toBe('function');
    });

    test('should return undefined when automock disabled for not explicitly mocked', () => {
      // ACT
      tlocalopt({ automock: false });
      const mock = tmock();

      // ASSERT
      expect(mock.a).toBeUndefined();
    });
  });

  describe('collapseLongValues and collapseThreshold', () => {
    test.each([
      [{ a: 1 }, true, '<mock>({a: 1})'],
      [{ a: 11 }, true,  '<mock>({...})'],
      [{ a: 11 }, false,  '<mock>({a: 11})'],
      [[1, 2], true, '<mock>([1, 2])'],
      [[11, 2], true, '<mock>([...])'],
      [[11, 2], false, '<mock>([11, 2])'],
      [tmock('aa').f(), true, '<mock>(aa.f())'],
      [tmock('aaa').f(), true, '<mock>(<...>)'],
      [tmock('aaa').f(), false, '<mock>(aaa.f())'],
    ])('should collapse when stringified values length exceeds collapse threshold %#', (arg, collapseLongValues, expectedResult) => {
      // ARRANGE
      tlocalopt({
        collapseLongValues: collapseLongValues,
        collapseThreshold: 6,
      });
      const mock = tmock();

      // ACT
      const res = mock(arg);

      // ASSERT
      expect(tunmock(res)).toEqual(expectedResult);
    });
  });

  describe('defaultMockName', () => {
    test('should change default mock name', () => {
      // ACT
      tglobalopt({ defaultMockName: 'aaa' });

      // ASSERT
      expect(tunmock(tmock())).toBe('aaa');
    });
  });

  describe('quoteSymbol', () => {
    test('should use defined quotation symbol', () => {
      // ACT
      tglobalopt({ quoteSymbol: '~' });

      // ASSERT
      // eslint-disable-next-line quotes
      expect(tunmock(tmock()('a', "b", `c`))).toBe('<mock>(~a~, ~b~, ~c~)');
    });
  });

  describe('exposeFunctionNames', () => {
    test.each([
      [ false, function f() {}, '<mock>(<function>)'],
      [ false, new Function(), '<mock>(<function>)'],
      [ true, function f() {}, '<mock>(<function f>)'],
      [ true, new Function(), '<mock>(<function anonymous>)'],
    ])('should output function names when exposeFunctionNames is true %#', (exposeFunctionNames, func, expectedUnmocked) => {
      // ARRANGE
      tglobalopt({ exposeFunctionNames: exposeFunctionNames });
      const mock = tmock();

      // ACT
      const res = mock(func);

      // ASSERT
      expect(tunmock(res)).toBe(expectedUnmocked);
    });
  });

  describe('autoValuesPrefix', () => {
    test('should add prefix to auto mocked values', () => {
      // ARRANGE
      tlocalopt({ autoValuesPrefix: 'value from ' });
      const mock = tmock();

      // ACT
      const result = tunmock(mock());

      // ASSERT
      expect(result).toBe('value from <mock>()');
    });

    test('should put prefix before auto-generated values', () => {
      // ARRANGE
      tglobalopt({ autoValuesPrefix: 'value from ' });
      const mock = tmock();

      // ACT
      const res = {
        a: mock.a,
        b: mock.f(mock.g()).a,
        c: mock.f(tmock('')),
        d: mock.f(tmock('').a),
        e: tmock(),
        f: tmock(''),
      }

      // ASSERT
      expect(tunmock(res)).toEqual({
        a: 'value from <mock>.a',
        b: 'value from <mock>.f(<mock>.g()).a',
        c: 'value from <mock>.f()',
        d: 'value from <mock>.f(a)',
        e: 'value from <mock>',
        f: 'value from <mock>',
      });
    });
  });

  describe('externalMock', () => {
    test('should consider calls of explicitly defined functions', () => {
      // ARRANGE
      tlocalopt({ externalMock: jestMock });
      const mock = tmock([
        {
          f1: function () {},
          f2: function () {},
          p: {
            f3: () => undefined,
          },
          f4: [new Function()],
        },
        [m => m.p.f5, new Function()],
        [m => m.f6, function () {}],
      ]);

      // ACT
      mock.f2();
      mock.p.f3();
      mock.p.f3(1);
      mock.p.f3(() => undefined, undefined);
      mock.f4[0](true, false);
      mock.p.f5('');
      mock.f6();

      // ASSERT
      expect(tinfo(mock.f1).externalMock).not.toHaveBeenCalled();
      expect(tinfo(mock.f2).externalMock).toHaveBeenCalledTimes(1);
      expect(tinfo(mock.p.f3).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(mock.f4[0]).externalMock.mock.calls).toEqual([[true, false]]);
      expect(tinfo(mock.p.f5).externalMock.mock.calls).toEqual([['']]);
      expect(tinfo(mock.f6).externalMock).toHaveBeenCalledTimes(1);
    });

    test('should consider calls of functions that were not explicitly defined', () => {
      // ARRANGE
      tlocalopt({ externalMock: jestMock });
      const mock = tmock();

      // ACT
      mock.f1();
      mock.p.f2();
      mock.p.f2(1);
      mock.p.f2(() => undefined, undefined);
      mock.q[0](true, false);

      // ASSERT
      expect(tinfo(mock.f1).externalMock).toHaveBeenCalledTimes(1);
      expect(tinfo(mock.p.f2).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(mock.q[0]).externalMock.mock.calls).toEqual([[true, false]]);
    });
  });
});

describe('----------------------- tmock arguments ------------------------', () => {
  test('should accept empty arguments list', () => {
    expect(() => tmock()).not.toThrow();
  });

  test('should accept name as first argument', () => {
    // ACT
    const mock = tmock('mockName');

    // ASSERT
    expect(tunmock(mock)).toBe('mockName');
  });

  test('should accept tuple as first or second argument', () => {
    // ARRANGE
    const initCouple: TInit = [(m) => m.a, 1];

    // ACT
    const mock1 = tmock(initCouple);
    const mock2 = tmock('', initCouple);

    // ASSERT
    expect(tunmock(mock1.a)).toBe(1);
    expect(tunmock(mock2.a)).toBe(1);
  });

  test('should accept object as first or second argument', () => {
    // ARRANGE
    const initializers: TInit = {
      a: 3,
    };

    // ACT
    const mock1 = tmock(initializers);
    const mock2 = tmock('', initializers);

    // ASSERT
    const unmockedInitializers = {
      a: 3,
    };
    expect(tunmock(mock1)).toEqual(unmockedInitializers);
    expect(tunmock(mock2)).toEqual(unmockedInitializers);
  });

  test('should accept array of tuples and objects as first or second argument', () => {
    // ARRANGE
    const initializers: TInit = [
      [(m) => m.a, 1],
      { b: 3 },
      [(m) => m.c, 5],
      { d: 7 },
    ];

    // ACT
    const mock1 = tmock(initializers);
    const mock2 = tmock('', initializers);

    // ASSERT
    const unmockedInitializers = {
      a: 1,
      b: 3,
      c: 5,
      d: 7,
    };
    expect(tunmock(mock1)).toEqual(unmockedInitializers);
    expect(tunmock(mock2)).toEqual(unmockedInitializers);
  });

  test.skip('Mock static type checking should work for non-generic form', () => {
    tmock([m => m.anyProp, 7]); // ok
    tmock([ [m => m.anyProp, 7] ]); // ok
    tmock([
      [m => m.prop, tmock([nested => nested.q, 1])],
    ]); // ok
    tmock([
      [m => m.prop, tmock('nestedMock', [
        [nested => nested.q, 1],
      ])],
    ]); // ok
    tmock({ anyProp: 7 }); // ok
    tmock([
      [m => m.prop, tmock([nested => nested.q, 1])],
      { anyProp: 7 },
    ]); // ok

    tmock('s', [m => m.anyProp, 7]); // ok
    tmock('s', [ [m => m.anyProp, 7] ]); // ok
    tmock('s', [
      [m => m.prop, tmock([nested => nested.q, 1])],
    ]); // ok
    tmock('s', [
      [m => m.prop, tmock('nestedMock', [
        [nested => nested.q, 1],
      ])],
    ]); // ok
    tmock('s', { anyProp: 7 }); // ok
    tmock('s', [
      [m => m.prop, tmock([nested => nested.q, 1])],
      { anyProp: 7 },
    ]); // ok

    // // UNCOMMENT THE WHOLE COMMENTED BLOCK TO TEST STATIC TYPE CHECKING
    // tmock([() => 1]); // type error
    // tmock([ [7] ]); // type error
    // tmock('s', [() => 1]); // type error
    // tmock('s', [ [7] ]); // type error
    // tmock('s', [
    //   [m => m.prop, tmock('s', 's')],
    // ]); // type error
  });

  test.skip('Mock static type checking should work for generic form', () => {
    // ARRANGE
    interface I {
      existingProp1: number;
      existingProp2: number;
    }

    // ACT + ASSERT
    tmock<I>(); // ok
    tmock<I>([m => m.existingProp1, 7]); // ok
    tmock<I>([ [m => m.existingProp1, 7] ]); // ok
    tmock<I>([ { existingProp1: 7 } ]); // ok
    tmock<I>([
      [m => m.existingProp1, 7],
      { existingProp2: 7 },
    ]); // ok
    tmock<I>('s'); // ok
    tmock<I>('s' ,[m => m.existingProp1, 7]); // ok
    tmock<I>('s' ,[ [m => m.existingProp1, 7] ]); // ok
    tmock<I>('s' ,[ { existingProp1: 7 } ]); // ok
    tmock<I>('s' ,[
      [m => m.existingProp1, 7],
      { existingProp2: 7 },
    ]); // ok

    // // UNCOMMENT THE WHOLE COMMENTED BLOCK TO TEST STATIC TYPE CHECKING
    // tmock<I>([m => m.nonExistingProp, 7]); // type error
    // tmock<I>({
    //   existingProp1: 1, // ok
    //   nonExistingProp: 1, // type error
    // });
    // tmock<I>([
    //   [(m) => m.existingProp1, 1], // ok
    //   [(m) => m.nonExistingProp, 1], // type error
    // ]);
    // tmock<I>([
    //   [(m) => m.nonExistingProp, 1], // type error
    //   [(m) => m.existingProp1, 1], // ok
    //   {
    //     existingProp: 1, // ok
    //     nonExistingProp: 1, // type error
    //   },
    // ]);
    // tmock<I>('s', [m => m.anyProp, 7]); // type error
    // tmock<I>('', {
    //   existingProp1: 1, // ok
    //   nonExistingProp: 1, // type error
    // });
    // tmock<I>('', [
    //   [(m) => m.existingProp1, 1], // ok
    //   [(m) => m.nonExistingProp, 1], // type error
    // ]);
    // tmock<I>('', [
    //   [(m) => m.nomExistingProp, 1], // type error
    //   [(m) => m.existingProp1, 1], // ok
    //   {
    //     existingProp2: 1, // ok
    //     nonExistingProp: 1, // type error
    //   },
    // ]);
  });

  test('should throw when more then one initializer argument provided', () => {
    expect(() => tmock([], [])).toThrow('tmock: multiple initializer arguments not allowed');
  });
});

describe('-------------------- mock behavior ----------------------', () => {
  test('expect with tmock argument should not crash', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(mock).toBeDefined();
  });

  test('should be callable', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    mock();

    // ASSERT
    const res = tunmock(mock);
    expect(res).toEqual(expect.any(Function));
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_CLASSES_ARRAYS,
  ])('should return predefined scalars, objects and arrays %#', (initialStub) => {
    // ARRANGE
    const mock = tmock({ a: initialStub });

    // ACT + ASSERT
    expect(mock.a).toEqual(initialStub);
  });

  test('should return predefined classes as is', () => {
    // ARRANGE
    class A { };
    const a = new A();
    const mock = tmock([{
      class: a,
    }]);

    // ASSERT
    expect(mock.class).toBe(a);
  });

  test.each([
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(() => DFAULT_NUMERIC_VALUE),
  ])('should be able to call functions and access predefined function properties %#', (initialStub) =>
  {
    // ARRANGE
    const s = Symbol('s');
    (initialStub as any).a = 3;
    (initialStub as any)[s] = 'sss';

    // ACT
    const mock = tmock([{ f: initialStub }]);

    // ASSERT
    expect(mock.f()).toBe(DFAULT_NUMERIC_VALUE);
    expect(mock.f.a).toBe(3);
    expect(mock.f[s]).toBe('sss');
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_CLASSES_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should preserve assigned values as is', (val) => {
    // ARRANGE
    const mock = tmock();

    // ACT
    mock.a = val;

    // ASSERT
    expect(mock.a).toBe(val);
  });

  test('values assigned to mock should override predefined values', () => {
    // ARRANGE
    const mock = tmock([{ a: 1 }]);
    tset(mock, [(m) => m.b, 3]);
    tset(mock, [(m) => m.c.cc, 5]);

    // ACT
    mock.a = 'a';
    mock.b = 'b';
    mock.c.cc = undefined;

    // ASSERT
    expect(mock.a).toBe('a');
    expect(mock.b).toBe('b');
    expect(mock.c.cc).toBeUndefined();
  });

  test('should allow to assign function properties and function should remain callable', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    mock.a.b.c = null;
    mock.a(1).b.c = [1];

    // ASSERT
    expect(mock.a.b.c).toBe(null);
    expect(mock.a(1).b.c).toEqual([1]);
    const res = tunmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a.b.c).toBe(null);
    expect(res.a(1).b.c).toEqual([1]);
  });

  test('mock should allow to call function and then assign function properties', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    mock.a(1).b.c = [1];
    mock.a.b.c = null;

    // ASSERT
    expect(mock.a(1).b.c).toEqual([1]);
    expect(mock.a.b.c).toBe(null);
    const res = tunmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a(1).b.c).toEqual([1]);
    expect(res.a.b.c).toBe(null);
  });

  test('should call both original function and external mock', () => {
    // ARRANGE
    tlocalopt({ externalMock: jestMock });
    const mock = tmock({ f: jest.fn() });
    // tset(mock, [(m) => m.f(7), 3]); // TODO: explore this case

    // ACT
    mock.f();
    mock.f(7);

    // ASSERT
    expect(mock.f).toHaveBeenCalledTimes(2);
    expect(tinfo(mock.f).externalMock).toHaveBeenCalledTimes(2);
  });

  test('should return empty array for spread operator', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    const res = [...mock];

    // ASSERT
    expect(res).toEqual([]);
  });

  test('should unmock mocks in arguments passed to spies', () => {
    // ARRANGE
    tlocalopt({ externalMock: jestMock });
    const mock = tmock([{
      f1: jest.fn((arg) => arg),
    }]);

    // ACT
    const result = mock.f1(mock);
    mock.f2(mock);
    mock.f3({ prop: mock }, [mock]);

    // ASSERT
    expect(result).toEqual({ f1: expect.anything() });
    expect(mock.f1).toHaveBeenCalledWith({ f1: expect.anything() });
    const unmockedUfterAllTouches = {
      f1: expect.anything(),
      f2: expect.anything(),
      f3: expect.anything(),
    };
    expect(tinfo(mock.f2).externalMock).toHaveBeenCalledWith(unmockedUfterAllTouches);
    expect(tinfo(mock.f3).externalMock).toHaveBeenCalledWith({ prop: unmockedUfterAllTouches }, [unmockedUfterAllTouches]);
  });
});

describe('-------------------- tstub ----------------------', () => {
  test('should accept object as argument', () => {
    // ACT
    const stub = tstub({ a: 1 });

    // ASSERT
    expect(stub).toEqual({ a: 1 });
  });

  test('should accept init couple as argument', () => {
    // ACT
    const stub = tstub([(s) => s.a, 1]);

    // ASSERT
    expect(stub).toEqual({ a: 1 });
  });

  test('should accept array of couples and objects as argument', () => {
    // ACT
    const stub = tstub([
      [(s) => s.a, 1],
      { b: 3 },
      [(s) => s.c, 5],
      { d: 7 },
    ]);

    // ASSERT
    expect(stub).toEqual({
      a: 1,
      b: 3,
      c: 5,
      d: 7,
    });
  });

  test.skip('static type checking should work for non-generic form', () => {
    tstub([m => m.anyProp, 7]); // ok
    tstub([ [m => m.anyProp, 7] ]); // ok
    tstub([
      [m => m.prop, tstub([nested => nested.q, 1])],
    ]); // ok
    tstub({ anyProp: 7 }); // ok
    tstub([
      [m => m.prop, 1],
      { anyProp: 7 },
    ]); // ok

    // // UNCOMMENT THE WHOLE COMMENTED BLOCK TO TEST STATIC TYPE CHECKING
    // tstub([() => 1]); // type error
    // tstub([ [7] ]); // type error
    // tstub('s'); // type error
  });

  test.skip('static type checking should work for generic form', () => {
    // ARRANGE
    interface I {
      existingProp1: number;
      existingProp2: number;
    }

    // ACT + ASSERT
    tstub<I>([m => m.existingProp1, 7]); // ok
    tstub<I>([ [m => m.existingProp1, 7] ]); // ok
    tstub<I>([ { existingProp1: 7 } ]); // ok
    tstub<I>([
      [m => m.existingProp1, 7],
      { existingProp2: 7 },
    ]); // ok

    // // UNCOMMENT THE WHOLE COMMENTED BLOCK TO TEST STATIC TYPE CHECKING
    // tstub<I>('s'); // type error
    // tstub<I>([m => m.nonExistingProp, 7]); // type error
    // tstub<I>({
    //   existingProp1: 1, // ok
    //   nonExistingProp: 1, // type error
    // });
    // tstub<I>([
    //   [(m) => m.existingProp1, 1], // ok
    //   [(m) => m.nonExistingProp, 1], // type error
    // ]);
    // tstub<I>([
    //   [(m) => m.nonExistingProp, 1], // type error
    //   [(m) => m.existingProp1, 1], // ok
    //   {
    //     existingProp: 1, // ok
    //     nonExistingProp: 1, // type error
    //   },
    // ]);
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_CLASSES_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should replace old stub values with new ones %#', (originalValue) => {
    // ACT
    const stub = tstub([
      {
        a: originalValue,
      },
      [(s) => s.a, 'aaa'],
      [(s) => s.f(), originalValue],
      [(s) => s.f(), 'bbb'],
    ]);

    // ASSERT
    expect(stub.a).toBe('aaa');
    expect(stub.f()).toBe('bbb');
  });

  test('should replece scalar with object when setting up property of scalar', () => {
    // ACT
    const stub = tstub([
      [(s) => s.a, 1],
      [(s) => s.a.aa, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toEqual({ aa: 'aa' });
  });

  test('should replece value constructed by multiple setups with new value', () => {
    // ACT
    const stub = tstub([
      [(s) => s.a.aa, {} ],
      [(s) => s.a.aa.aaa, 1 ],
      [(s) => s.a.bb, 3 ],
      [(s) => s.a, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toBe('aa');
  });

  test('should complement object through successive setups', () => {
    // ACT
    const stub = tstub([
      {
        a: {
          aa: 1,
          bb: 3,
          cc: {
            ccc: 5,
          },
        },
        b: Object.create(null),
      },
      [(s) => s.a.cc.ddd, 7],
      [(s) => s.c.cc, undefined],
      [(s) => s.d, ''],
    ]);

    // ASSERT
    expect(stub).toEqual({
      a: {
        aa: 1,
        bb: 3,
        cc: {
          ccc: 5,
          ddd: 7,
        },
      },
      b: {},
      c: {
        cc: undefined,
      },
      d: '',
    });
  });

  test('should return values defined per sets of arguments', () => {
    // ACT
    const stub = tstub([
      [(s) => s.f(), 1],
      [(s) => s.f(1), 3],
      [(s) => s.f(1, 3), 5],
    ]);

    // ASSERT
    expect(stub.f()).toBe(1);
    expect(stub.f(1)).toBe(3);
    expect(stub.f(1, 3)).toBe(5);
  });

  test('should return value defined for TM_ANY for set of arguments not mapped to return value', () => {
    // ACT
    const stub = tstub([
      [s => s.f(1, 3), 1],
      [s => s.f(tm.ANY.toString()), 3],
      [s => s.f(TM_ANY), 5],
    ]);

    // ASSERT
    expect(stub.f(1, 3)).toBe(1);
    expect(stub.f(tm.ANY.toString())).toBe(3);
    expect(stub.f()).toBe(5);
    expect(stub.f(1)).toBe(5);
    expect(stub.f(tm.ANY)).toBe(5);
  });

  test('should return undefined when neither set of arguments mapped to return value nor value for TM_ANY is provided', () => {
    // ACT
    const stub = tstub([
      [(s) => s.f(), 1],
    ]);

    // ASSERT
    expect(stub.f()).toBe(1);
    expect(stub.f(1)).toBeUndefined();
  });

  test('should complement return values and function properties through successive setups', () => {
    // ACT
    const stub = tstub([
      [(s) => s.f.prop1, '1'],
      [(s) => s.f(1), { b: 3 }],
      [(s) => s.f(1).a.aa.aaa1, 5],
      [(s) => s.f(1).a.aa.aaa2, 7],
      [(s) => s.f.prop2, null],

      [(s) => s.f1, function () { return 1; }],
      [(s) => s.f1.prop, 7 ],
      [(s) => s.f1(), 'aaa' ],
    ]);

    // ASSERT
    expect(stub.f(1)).toEqual({
      a: {
        aa: {
          aaa1: 5,
          aaa2: 7,
        },
      },
      b: 3,
    });
    expect(stub.f.prop1).toBe('1');
    expect(stub.f.prop2).toBe(null);

    expect(stub.f1()).toBe('aaa');
    expect(stub.f1.prop).toBe(7);
  });

  test('should be able to create callable stub', () => {
    // ACT
    const stub = tstub([
      [s => s(), 1],
    ]);

    // ASSERT
    expect(stub()).toBe(1);
  });

  test('should be able to replace root', () => {
    // ACT
    const stub = tstub([s => s, 1]);

    // ASSERT
    expect(stub).toBe(1);
  });

  test('should use last root replacement after serie of root replacements', () => {
    // ACT
    const stub = tstub([
      [s => s, 1],
      // First root replacement.
      [s => s, { a: 1 }],
      [s => s.b, 3],
      // Second root replacement.
      [s => s, { c: 5 }],
      [s => s.d, 7],
    ]);

    // ASSERT
    expect(stub).toEqual({
      c: 5,
      d: 7,
    });
  });
});

describe('-------------------- tunmock ---------------------', () => {
  test.each([
    ...SCALARS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should keep scalars and functions as is %#', (value) => {
    // ARRANGE
    const mock = tmock();
    mock.value = value;

    // ACT
    const res = tunmock(mock.value);

    // ASSERT
    expect(res).toBe(value);
  });

  test.each([
    [new Function(), '<mock>(<function>)'],
    [() => undefined, '<mock>(<arrow function>)'],
    [function () { return null; }, '<mock>(<function>)'],
    [function f() { return null; }, '<mock>(<function>)'],
  ])('should unmock functions passed to mock functions as arguments %#', (functionPasseToMock, expectedResult) => {
    // ARRANGE
    const mock = tmock();

    // ACT
    const res = mock(functionPasseToMock)

    // ASSERT
    expect(tunmock(res)).toBe(expectedResult);
  });

  test('should unmock mocks recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.prop, tmock('nestedMockLevel1', [
        [(m) => m.prop, tmock('nestedMockLevel2', [
          [(m) => m.prop, 'value'],
          [(m) => m.prop1, tmock()],
        ])],
      ])],
    ]);

    mock.prop.prop.prop2 = 'prop assigned by sut';

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      prop: {
        prop: {
          prop: 'value',
          prop1: '<mock>',
          prop2: 'prop assigned by sut',
        },
      },
    });
  });

  test('should unmock arrays recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.prop,
        [
          1,
          [3],
          tmock(),
          { a: 1 },
          undefined,
          null,
        ],
      ],
    ]);

    mock.prop.push('aaa');

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      prop: [
        1,
        [3],
        '<mock>',
        { a: 1 },
        undefined,
        null,
        'aaa',
      ],
    });
  });

  test('should return original functions with properties copied from mock', () => {
    // ARRANGE
    function f () {}
    const mock = tmock('some mock', [
      [(m) => m.f, f],
    ]);

    mock.f.prop = 1;

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(Object.create(f.prototype) instanceof res.f).toBe(true);
    expect(res.f.prop).toBe(1);
  });

  test('should return functions for function mocks with properties preserved', () => {
    // ARRANGE
    const mock = tmock('some mock', [
      [(m) => m.f(), 1],
    ]);

    const s = Symbol('s');
    mock.f.prop = 1;
    mock.f[s] = '1';
    mock.g();
    mock.g.prop = 3;
    mock.g[s] = '3';

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res.f).toStrictEqual(expect.any(Function));
    expect(res.f()).toBe(1);
    expect(res.f.prop).toBe(1);
    expect(res.f[s]).toBe('1');
    expect(res.g).toStrictEqual(expect.any(Function));
    expect(res.g.prop).toBe(3);
    expect(res.g[s]).toBe('3');
  });

  test('unmocked function should return predefined values for known arguments, otherwise automock value', () => {
    // ARRANGE
    const mock = tmock();
    tset(mock, [(m) => m.f('a'), 1]);

    // ACT
    mock.f('a');
    mock.f('b');

    // ASSERT
    const res = tunmock(mock);
    expect(res.f()).toBe(undefined);
    expect(res.f('a')).toBe(1);
    expect(res.f('b')).toBe(`<mock>.f('b')`);
  });

  test('should unmock objects recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.o, {
        a: tmock(),
      }],
    ]);
    mock.b = 7;

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      o: {
        a: '<mock>',
      },
      b: 7,
    });
  });

  test('should unmock classes', () => {
    // ARRANGE
    class A {
      a: number;
      constructor (a: number) {
        this.a = a;
      }
      f () {}
    }
    const mock = tmock();

    // ACT
    const res = tunmock(new A(mock));

    // ASSERT
    expect(res).toEqual({
      a: '<mock>',
    });
  });

  test('should not end up with stack overflow unmocking cyclic object values', () => {
    // ARRANGE
    const parent = {
      prop: tmock('parent_prop'),
      child: {},
    }
    const child = {
      prop: tmock('child_prop'),
      parent: parent,
    }
    parent.child = child;

    // ACT + ASSERT
    expect(() => tunmock(child)).not.toThrow();
    const res = tunmock(child);
    expect(res.prop).toBe('child_prop');
    expect(res.parent.prop).toBe('parent_prop');
  });
});

describe('-------------------- tset ---------------------', () => {
  test('should not allow to mock at root level', () => {
    // ARRANGE
    const mock = tmock();

    // ACT + ASSERT
    expect(() => tset(mock, [(m) => m, 1])).toThrow('Mocking at root level is not allowed');
  });

  test.each([
    [[m => m.a, 1], { a: 1 }],
    [{ a: 1 }, { a: 1 }],
    [[[m => m.a, 1]], { a: 1 }],
    [[{ a: 1 }], { a: 1 }],
    [[[m => m.a, 1], { b: 3 }, [m => m.c, 5], { d: 7 }], { a: 1, b: 3, c: 5, d: 7 }],
  ])('should accept tuple, object or array of tuples and objects as argument', (initializer: any, expectedResult: any) => {
    // ARRANGE
    const mock = tmock();
    const stub = tstub({});

    // ACT
    tset(mock, initializer);
    tset(stub, initializer);

    // ACT + ASSERT
    expect(tunmock(mock)).toEqual(expectedResult);
    expect(stub).toEqual(expectedResult);
  });

  test.each([
    m => m.a,
    m => m.a.b.c,
    m => m.b[3],
    m => m(),
    m => m()(),
    m => m.f(),
    m => m.a.f(),
    m => m.f().a,
    m => m.f().g(),
    m => m.f()(),
    m => m.f()().a,
    m => m.f().a.g().h,
  ])('should set mock values %#', (initExpression) => {
    // ARRANGE
    const mock = tmock();

    // ACT
    tset(mock, [initExpression, 1]);

    // ASSERT
    expect(initExpression(mock)).toBe(1);
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_CLASSES_ARRAYS,
  ])('should return mock values for scalars, objects, arrays and classes', (value) => {
    // ARRANGE
    const mock = tmock();
    tset(mock, [(m) => m.a, value]);

    // ACT
    const result = mock.a;

    // ASSERT
    expect(result).toEqual(value);
  });

  test.each([
    ['should copy enumerable descriptors enumerable properties with', true, 'a', 'b!!!'],
    ['DOES NOT COPY NON-ENUMERABLE PROPERTIES', false, undefined, 'b'],
  ])('%#', (__, enumerable, expectedProp1, expectedProp2) => {
    // ARRANGE
    const obj = {};
    Object.defineProperty(obj, 'prop1', {
      enumerable: enumerable,
      value: 'a',
    });
    Object.defineProperty(obj, 'prop2', {
      enumerable: enumerable,
      get() {
        return this._prop1;
      },
      set(x) {
        this._prop1 = x + '!!!';
      },
    });

    const mock = tmock([{
      o: obj,
    }]);

    // ACT
    mock.o.prop2 = 'b';

    // ASSERT
    expect(mock.o.prop1).toBe(expectedProp1);
    expect(mock.o.prop2).toBe(expectedProp2);
  });

  test('should return function that calls original function internally', () => {
    // ARRANGE
    const jestFunction = jest.fn();
    function f() {
      jestFunction();
      return 1;
    };
    const mock = tmock();
    tset(mock, [(m) => m.a, f]);

    // ACT
    mock.a();
    const result = mock.a();

    // ASSERT
    expect(result).toBe(1);
    expect(jestFunction).toHaveBeenCalledTimes(2);
  });

  test('should override values', () => {
    // ARRANGE
    const mock = tmock([{ a: 0 }]);

    // ACT + ASSERT
    tset(mock, [(m) => m.a, 1]);
    tset(mock, [(m) => m.a, 2]);
    expect(mock.a).toBe(2);

    tset(mock, [(m) => m.b.c, 1]);
    tset(mock, [(m) => m.b, 2]);
    expect(mock.b).toBe(2);
    expect(mock.b.c).toBeUndefined();

    tset(mock, [(m) => m['c'], 1]);
    tset(mock, [(m) => m['c']['d'], 2]); // TODO: is his behavior ok?
    expect(mock.c).not.toBe(1);
    expect(mock.c.d).toBe(2);

    tset(mock, [(m) => m.array[0], 1]);
    tset(mock, [(m) => m.array[0], 2]);
    expect(mock.array[0]).toBe(2);

    tset(mock, [(m) => m.f(1), 1]);
    tset(mock, [(m) => m.f(1), 2]);
    expect(mock.f(1)).toBe(2);

    tset(mock, [(m) => m.f(1), 1]);
    tset(mock, [(m) => m.f(1).a, 2]);
    expect(mock.f(1)).not.toBe(1);
    expect(mock.f(1).a).toBe(2);

    tset(mock, [(m) => m.f().a, 1]);
    tset(mock, [(m) => m.f(), 2]);
    expect(mock.f().a).toBeUndefined();
    expect(mock.f()).toBe(2);

    tset(mock, [(m) => m.f.a, 1]);
    tset(mock, [(m) => m.f.b, 2]);
    tset(mock, [(m) => m.f(), undefined]);
    tset(mock, [(m) => m.f.b, 3]);
    expect(mock.f.a).toBe(1);
    expect(mock.f.b).toBe(3);

    tset(mock, [(m) => m.f(), 1]);
    tset(mock, [(m) => m.f()(), 2]);
    expect(mock.f()).not.toBe(1);
    expect(mock.f()()).toBe(2);

    tset(mock, [(m) => m.f()(), 1]);
    tset(mock, [(m) => m.f(), 2]);
    expect(() => mock.f()()).toThrow('mock.f(...) is not a function');
    expect(mock.f()).toBe(2);

    tset(mock, [(m) => m.a, 2]);
    tset(mock, [(m) => m.a.f(), 2]);
    tset(mock, [(m) => m.a.f().g, 3]);
    expect(mock.a.f().g).toBe(3);

    tset(mock, [(m) => m.a, 2]);
    tset(mock, [(m) => m.a.f(), 2]);
    tset(mock, [(m) => m.a.f().g(), 3]);
    expect(mock.a.f().g()).toBe(3);
  });

  test('should return value setup for tm.ANY for unknown arguments', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.f(3), '333' ],
      [m => m.f(tm.ANY), 'aaa' ],
      [m => m.f(5), '555' ],
      [m => m.f(tm.ANY.toString()), '777' ],
    ]);

    // ASSERT
    expect(mock.f(3)).toBe('333');
    expect(mock.f(5)).toBe('555');
    expect(mock.f(tm.ANY.toString())).toBe('777');
    expect(mock.f()).toBe('aaa');
    expect(mock.f(777)).toBe('aaa');
    expect(mock.f(3, 5)).toBe('aaa');
  });

  test('should mock call result per set of call arguments', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    tset(mock, [(m) => m.f(), 'f()']);
    tset(mock, [(m) => m.f(1), 'f(1)']);
    tset(mock, [(m) => m.f(0), 'f(0)']);
    tset(mock, [(m) => m.f(-1), 'f(-1)']);
    tset(mock, [(m) => m.f(.1), 'f(.1)']);
    tset(mock, [(m) => m.f(1.1), 'f(1.1)']);
    tset(mock, [(m) => m.f('1'), `f('1')`]);
    tset(mock, [(m) => m.f('1', '1'), `f('1', '1')`]);
    tset(mock, [(m) => m.f('1', '2'), `f('1', '2')`]);
    tset(mock, [(m) => m.f('2', '1'), `f('2', '1')`]);
    tset(mock, [(m) => m.f(undefined), 'f(undefined)']);
    tset(mock, [(m) => m.f(null), 'f(null)']);
    tset(mock, [(m) => m.f(''), `f('')`]);
    tset(mock, [(m) => m.f(true), 'f(true)']);
    tset(mock, [(m) => m.f(false), 'f(false)']);
    tset(mock, [(m) => m.f({}), 'f({})']);
    tset(mock, [(m) => m.f({ a: 1, b: 1 }), 'f({ a: 1, b: 1 })']);
    tset(mock, [(m) => m.f({ b: 1, a: 1 }), 'f({ b: 1, a: 1 })']);
    tset(mock, [(m) => m.f({ a: [1] }), 'f({ a: [1] })']);
    tset(mock, [(m) => m.f([]), 'f([])']);
    tset(mock, [(m) => m.f([1]), 'f([1])']);
    tset(mock, [(m) => m.f([1, undefined]), 'f([1, undefined])']);
    tset(mock, [(m) => m.f([undefined, 1]), 'f([undefined, 1])']);
    tset(mock, [(m) => m.f([{ a: 1 }]), 'f([{ a: 1 }])']);
    tset(mock, [(m) => m.f([{ a: 2 }]), 'f([{ a: 2 }])']);
    tset(mock, [(m) => m.f(() => 1), 'f(() => 1)']);
    tset(mock, [(m) => m.f(() => 2), 'f(() => 2)']);
    tset(mock, [(m) => m.f((a: any) => 1), 'f((a: any) => 1)']); // eslint-disable-line @typescript-eslint/no-unused-vars
    tset(mock, [(m) => m.f(NaN), 'f(NaN)']);
    tset(mock, [(m) => m.f(Infinity), 'f(Infinity)']);
    tset(mock, [(m) => m.f(-Infinity), 'f(-Infinity)']);
    tset(mock, [(m) => m.f(Symbol()), 'f(Symbol())']);
    tset(mock, [(m) => m.f(Symbol(1)), 'f(Symbol(1))']);

    // ASSERT
    expect(mock.f()).toBe('f()');
    expect(mock.f(1)).toBe('f(1)');
    expect(mock.f(0)).toBe('f(0)');
    expect(mock.f(-1)).toBe('f(-1)');
    expect(mock.f(.1)).toBe('f(.1)');
    expect(mock.f(1.1)).toBe('f(1.1)');
    expect(mock.f('1')).toBe(`f('1')`);
    expect(mock.f('1', '1')).toBe(`f('1', '1')`);
    expect(mock.f('1', '2')).toBe(`f('1', '2')`);
    expect(mock.f('2', '1')).toBe(`f('2', '1')`);
    expect(mock.f(undefined)).toBe('f(undefined)');
    expect(mock.f(null)).toBe('f(null)');
    expect(mock.f('')).toBe(`f('')`);
    expect(mock.f("")).toBe(`f('')`); // eslint-disable-line quotes
    expect(mock.f(``)).toBe(`f('')`);
    expect(mock.f(true)).toBe('f(true)');
    expect(mock.f(false)).toBe('f(false)');
    expect(mock.f({})).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f(Object.create({}))).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f(Object.create(null))).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f({ a: 1, b: 1 })).toBe('f({ a: 1, b: 1 })');
    expect(mock.f({ b: 1, a: 1 })).toBe('f({ b: 1, a: 1 })');
    expect(mock.f({ a: [1] })).toBe('f({ a: [1] })');
    expect(mock.f([])).toBe('f([])');
    expect(mock.f([1])).toBe('f([1])');
    expect(mock.f([1, undefined])).toBe('f([1, undefined])');
    expect(mock.f([undefined, 1])).toBe('f([undefined, 1])');
    expect(mock.f([{ a: 1 }])).toBe('f([{ a: 1 }])');
    expect(mock.f([{ a: 2 }])).toBe('f([{ a: 2 }])');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expect(mock.f((a: any) => 1)).toBe('f((a: any) => 1)'); //Do not distinguish function args and bodies
    expect(mock.f(() => 1)).toBe('f((a: any) => 1)'); // does not distinguish function args and bodies
    expect(mock.f(() => 2)).toBe('f((a: any) => 1)'); // does not distinguish function args and bodies
    expect(mock.f(NaN)).toBe('f(NaN)');
    expect(mock.f(Infinity)).toBe('f(Infinity)');
    expect(mock.f(-Infinity)).toBe('f(-Infinity)');
    expect(mock.f(Symbol())).toBe('f(Symbol())');
    expect(mock.f(Symbol(1))).toBe('f(Symbol(1))');
  });

  test('should not end up with stack overflow setting cyclic object values', () => {
    const parent = {
      child: {},
    };
    const child = {
      parent: parent,
      self: {},
      f: function () {},
    }
    child.self = child;
    (child.f as any).parent = child;
    parent.child = child;

    const mock = tmock();

    // ACT + ASSERT
    expect(() => tset(mock, [(m) => m.prop, child])).not.toThrow();
  });

  test.each([
    ...OBJECTS_CLASSES_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
  ])('should accept stubs produced by tstub %#', (stubRootReplacement) => {
    // ARRANGE
    const stub = tstub([s => s, stubRootReplacement]);

    // ACT + ASSERT
    expect(() => tset(stub, [s => s.prop, 'val'])).not.toThrow();
  });

  test('should not be able to replace stub root', () => {
    // ARRANGE
    const stub = tstub({});

    // ACT + ASSERT
    expect(() => tset(stub, [s => s, 1])).toThrow('tset: cannot replace stub root');
    expect(() => tset(stub, [s => s(), 1])).toThrow('tset: cannot replace stub root');
  });

  test.each([
    undefined,
    null,
    '',
    'a',
    1,
    { a: 1 },
    [1, 2, 3],
    function f() {},
  ])('should throw when first argument is neither mock nor stub', (argument) => {
    // ACT + ASSERT
    expect(() => tset(argument, [(m) => m, 1])).toThrow('tset: first argument should be either mock or stub');
  });
});

describe('------------------- treset --------------------', () => {
  test('reset of empty mock should not throw', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(() => treset(mock)).not.toThrow();
  })

  test('should restore mock return value overwritten in sut', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.untouched, 'u'],
      [m => m.replacedProp1, 'rp1'],
      [m => m.replacedProp2.prop, 'rp2.prop'],
      [m => m.replacedProp2.f(), 'rp2.f'],
      [m => m.replacedFunc().prop, 'rf().prop'],
      [m => m.replacedFunc(true), 'rf(true)'],
      [m => m.replacedFunc.prop, 'rf.prop'],
    ]);
    mock.replacedProp1 = 1;
    mock.replacedProp2 = 3;
    mock.replacedFunc = 5;
    expect(mock.untouched).toBe('u');
    expect(mock.replacedProp1).toBe(1);
    expect(mock.replacedProp2).toBe(3);
    expect(mock.replacedProp2.prop).toBe(undefined);
    expect(mock.replacedProp2.f).toBe(undefined);
    expect(mock.replacedFunc).toBe(5);
    expect(() => mock.replacedFunc()).toThrow();

    // ACT
    treset(mock);

    // ASSERT
    expect(mock.untouched).toBe('u');
    expect(mock.replacedProp1).toBe('rp1');
    expect(mock.replacedProp2.prop).toBe('rp2.prop');
    expect(mock.replacedProp2.f()).toBe('rp2.f');
    expect(mock.replacedProp2.f()).toBe('rp2.f');
    expect(mock.replacedFunc().prop).toBe('rf().prop');
    expect(mock.replacedFunc(true)).toBe('rf(true)');
    expect(mock.replacedFunc.prop).toBe('rf.prop');
  });

  test('should erase return values added in sut', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.f(1), 1],
    ]);
    mock.a.b.c = 3;
    mock.f(2).p = 5;
    expect(mock.f(1)).toBe(1);
    expect(mock.a.b.c).toBe(3);
    expect(mock.f(2).p).toBe(5);

    // ACT
    treset(mock);

    // ASSERT
    expect(mock.f(1)).toBe(1);
    expect(mock.a.b.c).not.toBe(3);
    expect(mock.f(2).p).not.toBe(5);
  });

  test('should erase mocks at any nesting levels and clear mock touches from unmocked result', () => {
    // ARRANGE
    // Create mock.
    const mock = tmock([{
      untouched: 7,
      replaced: true,
    }]);

    // Touch in sut.
    mock.a.e = 9;
    mock.a.aa.aaa;
    mock.a.aa1.aaa;
    mock.a.aa.aaa1;
    mock.b;
    mock.c.c;
    mock.replaced = false;
    mock.added = 'value';

    // ACT + ASSERT
    let res = tunmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: {
        aa: {
          aaa: '<mock>.a.aa.aaa',
          aaa1: '<mock>.a.aa.aaa1',
        },
        aa1: {
          aaa: '<mock>.a.aa1.aaa',
        },
        e: 9,
      },
      b: '<mock>.b',
      c: {
        c: '<mock>.c.c',
      },
    });

    treset(mock.a.aa);
    res = tunmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: {
        aa: '<mock>.a.aa',
        aa1: {
          aaa: '<mock>.a.aa1.aaa',
        },
        e: 9,
      },
      b: '<mock>.b',
      c: {
        c: '<mock>.c.c',
      },
    });

    treset(mock.a);
    res = tunmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: '<mock>.a',
      b: '<mock>.b',
      c: {
        c: '<mock>.c.c',
      },
    });

    treset(mock);
    res = tunmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: true,
    });
  });

  test('should erase mocks first touched by sut then setup by tset', () => {
    // ARRANGE
    // Create mock.
    const mock = tmock();

    // Touch in sut.
    mock.replaced1 = 'replaced1';
    mock.replaced2.prop = 'replaced2.prop';

    // Complement mock later
    tset(mock, [
      [m => m.replaced1, 'original1'],
      [m => m.replaced2, 'original2'],
    ])

    // ACT + ASSERT
    let res = tunmock(mock);
    expect(res).toEqual({
      replaced1: 'replaced1',
      replaced2: 'original2',
    });

    treset(mock);
    res = tunmock(mock);
    expect(res).toEqual({
      replaced1: 'original1',
      replaced2: 'original2',
    });
  });

  test('should erase return values per arguments added by sut', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.f(1), 1],
    ]);

    // Touch mock in sut.
    mock.f().p = 3;

    // Check result before reset.
    let res = tunmock(mock);
    expect(res.f(1)).toBe(1);
    expect(res.f()).toEqual({ p: 3 });

    // ACT
    treset(mock);

    // ASSERT
    res = tunmock(mock);
    expect(res.f(1)).toBe(1);
    expect(res.f()).toBeUndefined();
  });

  test('should erase nested mocks', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.prop, tmock('nestedMock', [
        [nested => nested.q, 1],
      ])],
    ]);

    // Touch mock in sut.
    mock.prop.q = 3;
    mock.prop.qqq = 5;

    // Check result before reset.
    let res = tunmock(mock);
    expect(res.prop.q).toBe(3);
    expect(res.prop.qqq).toBe(5);

    // ACT
    treset(mock);

    // ASSERT
    res = tunmock(mock);
    expect(res.prop.q).toBe(1);
    expect(res.prop.qqq).toBeUndefined();
  });

  test('should erase mock calls', () => {
    // ARRANGE
    tlocalopt({ collapseLongValues: false });
    const mock1 = tmock('mock1', [{ f: function fff() {} }]);
    const mock2 = tmock('mock2');

    // ACT
    const mock3 = mock1.prop.f(Infinity);
    mock1.f();
    mock2();
    mock2();
    mock2.f();
    mock1.prop.f();
    mock2(function () {}, [1], {'0': 1});
    mock1.prop.f(Infinity).prop.f2([]);

    // ASSERT
    expect(tinfo().callLog).toEqual([
      'mock1.prop.f(Infinity)',
      'mock1.f()',
      'mock2()',
      'mock2()',
      'mock2.f()',
      'mock1.prop.f()',
      'mock2(<function>, [1], {0: 1})',
      'mock1.prop.f(Infinity)',
      'mock1.prop.f(Infinity).prop.f2([])',
    ]);
    expect(tinfo(mock1).callLog).toEqual([
      'mock1.prop.f(Infinity)',
      'mock1.f()',
      'mock1.prop.f()',
      'mock1.prop.f(Infinity)',
      'mock1.prop.f(Infinity).prop.f2([])',
    ]);
    expect(tinfo(mock2).callLog).toEqual([
      'mock2()',
      'mock2()',
      'mock2(<function>, [1], {0: 1})',
    ]);

    // Reset mock1.prop.f(Infinity).
    treset(mock3);
    expect(tinfo().callLog).toEqual([
      'mock1.f()',
      'mock2()',
      'mock2()',
      'mock2.f()',
      'mock1.prop.f()',
      'mock2(<function>, [1], {0: 1})',
    ]);
    expect(tinfo(mock1).callLog).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tinfo(mock2).callLog).toEqual([
      'mock2()',
      'mock2()',
      'mock2(<function>, [1], {0: 1})',
    ]);

    // Reset mock2.
    treset(mock2);
    expect(tinfo().callLog).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tinfo(mock1).callLog).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tinfo(mock2).callLog).toEqual([]);

    // Reset mock2.
    treset(mock1);
    expect(tinfo().callLog).toEqual([]);
    expect(tinfo(mock1).callLog).toEqual([]);
    expect(tinfo(mock2).callLog).toEqual([]);
  });

  test('should erase touches of all mocks when argument is not provided', () => {
    // ARRANGE
    const mock1 = tmock([{
      a: 1,
    }]);
    mock1.a = 3;
    const mock2 = tmock();
    mock2.b = 1;

    // ACT
    treset();
    mock1.aaa;
    mock2.bbb;

    // ASSERT
    const res1 = tunmock(mock1);
    const res2 = tunmock(mock2);
    expect(res1).toEqual({
      a: 1,
      aaa: '<mock>.aaa',
    });
    expect(res2).toEqual({
      bbb: '<mock>.bbb',
    });
  });
});

describe('----------------- tinfo ------------------', () => {
  test('should throw when argument is neither mock nor spy', () => {
    // ACT + ASSERT
    expect(() => tinfo(() => undefined)).toThrow('tinfo: argument should be either mock or spy');
  });

  test.each([
    tmock({ f: function f() {} }).f, // <mock>.f is a spy
    undefined,
  ])('should throw when path argument provided for non-mock', (arg) => {
    // ACT + ASSERT
    expect(() => tinfo(arg, m => m)).toThrow('tinfo: pathInsideMock is allowed only for mocks');
  });

  describe('externalMock', () => {
    test('should return undefined externalMock when called without arguments', () => {
      // ACT + ASSERT
      expect(tinfo().externalMock).toBeUndefined();
    });

    test.each([
      ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
      jest.fn(() => DFAULT_NUMERIC_VALUE),
    ])('should setup externalMock property for functions when external mock is set %#', (initialStub) => {
      // ACT
      tlocalopt({ externalMock: jestMock });
      const mock = tmock([{ f: initialStub }]);

      // ASSERT
      expect(tinfo(mock.f).externalMock).toBeDefined();
      expect(tinfo(mock, m => m.f).externalMock).toBeDefined();
    });

    test.each([
      ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
      jest.fn(() => DFAULT_NUMERIC_VALUE),
    ])('should not setup externalMock property for functions when external mock is not set %#', (initialStub) => {
      // ACT
      const mock = tmock([{ f: initialStub }]);

      // ASSERT
      expect(tinfo(mock.f).externalMock).toBeUndefined();
      expect(tinfo(mock, m => m.f).externalMock).toBeUndefined();
    });
  });

  describe('callLog', () => {
    test('should return only mock calls when argument is provided, otherwise all calls', () => {
      // ARRANGE
      const mock1 = tmock('mock1', [{ f: function () {} }]);
      const mock2 = tmock('mock2', [{ f: function fff() {} }]);
      const mock3 = tmock();

      // ACT
      mock1.f();
      mock1.f(mock1.a.b.c);
      mock2.f();
      mock1.g();
      mock2.f1('1');
      mock2.f1(1).f2(2);
      mock2.f1(1).f2(2).f3(null, Symbol());
      mock3();

      // ASSERT
      expect(tinfo().callLog).toEqual([
        'mock1.f()',
        'mock1.f(mock1.a.b.c)',
        'mock2.f()',
        'mock1.g()',
        `mock2.f1('1')`,
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1).f2(2).f3(null, Symbol())',
        '<mock>()',
      ]);
      expect(tinfo(mock1).callLog).toEqual([
        'mock1.f()',
        'mock1.f(mock1.a.b.c)',
        'mock1.g()',
      ]);
      expect(tinfo(mock2).callLog).toEqual([
        'mock2.f()',
        `mock2.f1('1')`,
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1).f2(2).f3(null, Symbol())',
      ]);
      expect(tinfo(mock3).callLog).toEqual([
        '<mock>()',
      ]);
    });

    test('should not wrap mocks into quotes', () => {
      // ARRANGE
      function f(arg1, arg2) {
        arg1(arg2.prop.p);
      }
      const mock1 = tmock('mock1');
      const mock2 = tmock('mock2');
      f(mock1, mock2);

      // ACT
      const res = tinfo(mock1).callLog;

      // ASSERT
      expect(res).toEqual(['mock1(mock2.prop.p)']);
    });

    test('should filter calls', () => {
      // ARRANGE
      function sut(arg1) {
        arg1.a.f;
        arg1();
        arg1.a.f();
        arg1.a.g();
        arg1.fff();
        arg1.fff(1);
        arg1.fff().prop.g();
        arg1.fff(arg1.fff(7));
      }
      const mock1 = tmock('m');
      sut(mock1);

      // ACT + ASSERT
      expect(tinfo(mock1).callLog).toEqual(['m()']);
      expect(tinfo(mock1.a).callLog).toEqual(['m.a.f()', 'm.a.g()']);
      expect(tinfo(mock1.a.f).callLog).toEqual(['m.a.f()']);
      expect(tinfo(mock1.fff).callLog).toEqual(['m.fff()', 'm.fff(1)', 'm.fff()', 'm.fff(7)', 'm.fff(m.fff(7))']);
      expect(tinfo(mock1, m => m.a).callLog).toEqual(['m.a.f()', 'm.a.g()']);
      expect(tinfo(mock1, m => m.a.f).callLog).toEqual(['m.a.f()']);
      expect(tinfo(mock1, m => m.fff).callLog).toEqual(['m.fff()', 'm.fff(1)', 'm.fff()', 'm.fff(7)', 'm.fff(m.fff(7))']);
      expect(tinfo(mock1, m => m.fff().prop.g).callLog).toEqual(['m.fff().prop.g()']);
    });

    test('should return call log when argument is a spy or path inside mock leads to spy', () => {
      // ARRANGE
      const mock = tmock([{
        f1: function f() {},
        prop: {
          f2: function f() {},
        },
        f3: jest.fn(),
      }]);

      function sut(arg1) {
        arg1.f1();
        arg1.f1();
        arg1.prop.f2();
        arg1.f3();
      }

      sut(mock);

      // ACT + ASSERT
      expect(tinfo(mock.f1).callLog).toEqual(['<mock>.f1()', '<mock>.f1()']);
      expect(tinfo(mock.prop.f2).callLog).toEqual(['<mock>.prop.f2()']);
      expect(tinfo(mock.f3).callLog).toEqual(['<mock>.f3()']);
      expect(tinfo(mock, m => m.f1).callLog).toEqual(['<mock>.f1()', '<mock>.f1()']);
      expect(tinfo(mock, m => m.prop.f2).callLog).toEqual(['<mock>.prop.f2()']);
      expect(tinfo(mock, m => m.f3).callLog).toEqual(['<mock>.f3()']);
    });
  });

  describe('calls', () => {
    test('should return calls of particular function when mock or path to mock points to function that was called at least once', () => {
      // ARRANGE
      const mock = tmock([
        [m => m.f(), 'some value'],
      ]);

      mock(1);
      mock.f();
      mock.f(1, 2, 3);
      mock.f(1, 2, 3).b.g(mock(), true, false);

      // ACT + ASSERT
      expect(tinfo(mock).calls).toEqual([
        [1], // mock(1)
        [], // mock()
      ]);
      expect(tinfo(mock.f).calls).toEqual([
        [], // f()
        [1, 2, 3], // f(1, 2, 3)
        [1, 2, 3], // f(1, 2, 3)
      ]);
      expect(tinfo(mock, m => m.f).calls).toEqual([
        [], // f()
        [1, 2, 3], // f(1, 2, 3)
        [1, 2, 3], // f(1, 2, 3)
      ]);
      expect(tinfo(mock, m => m.f(1 ,2, 3).b.g).calls).toEqual([
        ['<mock>()', true, false], // g(mock(), true, false)
      ]);
    });

    test('should return empty calls when call was never applied to this mock or path directly', () => {
      // ARRANGE
      const mock = tmock();

      mock();
      mock.a.f(1);
      mock.a.f().g(-1);
      mock.f('');

      // ACT + ASSERT
      expect(tinfo(mock.a).calls).toEqual([]);
      expect(tinfo(mock, m => m.a).calls).toEqual([]);
    });

    test('should return calls when argument is a spy or path inside mock leads to spy', () => {
      // ARRANGE
      const mock = tmock({
        f1: function f() {},
        prop: {
          f2: function f() {},
        },
        f3: jest.fn(),
      });

      function sut(arg1) {
        arg1.f1(true);
        arg1.f1(undefined, 1, 's', arg1.a.b.c.f());
        arg1.prop.f2(null);
        arg1.f3();
      }

      sut(mock);

      // ACT + ASSERT
      expect(tinfo(mock.f1).calls[0]).toEqual([true]);
      expect(tinfo(mock.f1).calls[1]).toEqual([undefined, 1, 's', '<mock>.a.b.c.f()']);
      expect(tinfo(mock.prop.f2).calls[0]).toEqual([null]);
      expect(tinfo(mock.f3).calls[0]).toEqual([]);
      expect(tinfo(mock, m => m.f1).calls[0]).toEqual([true]);
      expect(tinfo(mock, m => m.f1).calls[1]).toEqual([undefined, 1, 's', '<mock>.a.b.c.f()']);
      expect(tinfo(mock, m => m.prop.f2).calls[0]).toEqual([null]);
      expect(tinfo(mock, m => m.f3).calls[0]).toEqual([]);
    });

    test('should return all calls when argument not provided', () => {
      // ARRANGE
      const mock = tmock('name', [{
        f: function f() {},
      }]);

      mock.f(mock.g('a', -1));
      mock.g().h(1);

      // ACT + ASSERT
      expect(tinfo().calls).toEqual([
        ['a', -1],
        [`name.g('a', -1)`],
        [],
        [1],
      ]);
    });

    test('should return unmocked argument-mock passed to spy', () => {
      // ARRANGE
      tlocalopt({ externalMock: jestMock });
      const mock = tmock([{
        f: jest.fn(),
      }]);
      const mockPassedToSpy = tmock('mock passed to spy');
      mockPassedToSpy.a = 7;
      mock.f(mockPassedToSpy);

      // ACT + ASSERT
      expect(tinfo(mock.f).calls[0][0]).toEqual({ a: 7 });
      expect(tinfo(mock.f).externalMock.mock.calls[0][0]).toEqual({ a: 7 });
      expect(tinfo(mock, m => m.f).calls[0][0]).toEqual({ a: 7 });
      expect(tinfo(mock, m => m.f).externalMock.mock.calls[0][0]).toEqual({ a: 7 });
    });
  });

  test('should return empty values when path inside mock leads to element not touched by mock', () => {
    // ARRANGE
    tlocalopt({ externalMock: jestMock });
    const mock = tmock();

    // ACT
    const result = tinfo(mock, m => m.a.b.c);

    // ASSERT
    expect(result.externalMock).toBeUndefined();
    expect(result.calls).toEqual([]);
    expect(result.callLog).toEqual([]);
  });
});

describe ('---------------- test with js -----------------', () => {
  test('hasOwnProperty should return true', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(mock.hasOwnProperty('a')).toBe(true);
  });

  test('implicit conversion should not crash', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(() => mock > 1).not.toThrow();
  });

  test('use case: operators', () => {
    // ARRANGE
    const mock = tmock();
    const f = (a, b) => a > b;
    function f1(obj) {
      obj.aaa = 1;
      obj.bbb = f(obj.a, obj.a) ? 1 : obj.a * 2;
      return obj;
    }

    // ACT
    const res = tunmock(f1(mock));

    // ASSERT
    expect(res.aaa).toBe(1);
    expect(res.bbb).toBe(NaN);
  });

  test('use case: to primitive', () => {
    // ACT
    const res = `${tmock()}`;

    // ASSERT
    expect(res).toBe('<mock>');
  });
});

test('checking calls demo', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.f1(), 1],
  ]);

  // ACT
  mock.f1();
  mock.prop.f2(1, false);
  mock.prop.f2({ b: 'b' }).g(1);

  // ASSERT
  // All calls log
  expect(tinfo().callLog).toEqual([
    '<mock>.f1()',
    '<mock>.prop.f2(1, false)',
    `<mock>.prop.f2({b: 'b'})`,
    `<mock>.prop.f2({b: 'b'}).g(1)`,
  ]);
  // Examine arguments of a particular call
  expect(tinfo(mock.prop.f2).calls[1][0]).toEqual({
    b: 'b',
  });
  expect(tinfo(mock, m => m.prop.f2({ b: 'b' }).g).calls[0][0]).toBe(1);
});
