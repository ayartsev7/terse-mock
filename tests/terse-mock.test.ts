﻿import tm, { TM_ANY, tset, treset, tmock, tunmock, tinfo, tglobalopt, IExternalMock, InitCouple, AnyInitializer,
  TmockGlobalOptions, tstub, TmockOptions,
} from '../src/terse-mock';

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

const OBJECTS_AND_ARRAYS = [
  objectWithTestSymbolProperty,
  Object.create(null),
  objectWithoutPrototypeWithProperty,
  {},
  { a: [1, 2, 3] },
  [],
  [{}, 7, { a: 1 }],
  new RegExp('a'),
];

const globalOptBackup = tglobalopt();

beforeEach(() => {
  tglobalopt(globalOptBackup);
});

test('all exported functions should have analogues in tm', () => {
  // ASSERT
  expect(tm.ANY).toBe(TM_ANY);
  expect(tm.set).toBe(tset);
  expect(tm.reset).toBe(treset);
  expect(tm.mock).toBe(tmock);
  expect(tm.stub).toBe(tstub);
  expect(tm.unmock).toBe(tunmock);
  expect(tm.info).toBe(tinfo);
  expect(tm.globalopt).toBe(tglobalopt);
});

describe('-------------------- tglobalopt ----------------------', () => {
  test('should accept empty options', () => {
    // ACT
    const globalOptions = tglobalopt();

    // ASSERT
    const expectedGlobalOpt: TmockGlobalOptions = {
      defaultMockName: 'mock',
      simplificationThreshold: 40,
      simplifiedOutput: true,
      automock: true,
      quoteSymbol: '\'',
      exposeFunctionNames: false,
      autoValuesPrefix: '',
    };
    expect(globalOptions).toEqual(expectedGlobalOpt);
  });

  test('should be merged options passed to tglobalopt', () => {
    // ACT
    const globalOptions = tglobalopt({
      defaultMockName: 'mock name',
      simplificationThreshold: 1,
      simplifiedOutput: false,
      // do not pass automockEnabled
      quoteSymbol: '"',
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    });

    // ASSERT
    const expectedGlobalOpt: TmockGlobalOptions = {
      defaultMockName: 'mock name',
      simplificationThreshold: 1,
      simplifiedOutput: false,
      automock: true,
      quoteSymbol: '"',
      exposeFunctionNames: true,
      autoValuesPrefix: 'value from ',
    };
    expect(globalOptions).toEqual(expectedGlobalOpt);
  });

  test.each([
    [ false, function f() {}, 'mock(<function>)'],
    [ false, new Function(), 'mock(<function>)'],
    [ true, function f() {}, 'mock(<function f>)'],
    [ true, new Function(), 'mock(<function anonymous>)'],
  ])('should output function names when exposeFunctionNames is set to true %#', (exposeFunctionNames, func, expectedUnmocked) => {
    // ARRANGE
    tglobalopt({ exposeFunctionNames: exposeFunctionNames });
    const mock = tmock();

    // ACT
    const res = mock(func);

    // ASSERT
    expect(tunmock(res)).toBe(expectedUnmocked);
  });

  test('should put prefix defined by autoValuesPrefix before auto-generated values', () => {
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
      a: 'value from mock.a',
      b: 'value from mock.f(mock.g()).a',
      c: 'value from mock.f(<unnamed mock>)',
      d: 'value from mock.f(a)',
      e: 'value from mock',
      f: 'value from <unnamed mock>',
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

  test('should treat empty string as name', () => {
    // ACT
    const mock = tmock('');
    mock.a;

    // ASSERT
    expect(tunmock(mock)).toEqual({ a: 'a' });
  });

  test('should accept init tuple as first or second argument', () => {
    // ARRANGE
    const initCouple: InitCouple = [(m) => m.a, 1];

    // ACT
    const mock1 = tmock(initCouple);
    const mock2 = tmock('', initCouple);

    // ASSERT
    expect(tunmock(mock1.a)).toBe(1);
    expect(tunmock(mock2.a)).toBe(1);
  });

  test('should accept array of initializers as first or second argument', () => {
    // ARRANGE
    const initializers: AnyInitializer[] = [
      { a: 1 },
      [(m) => m.b, 3],
    ];

    // ACT
    const mock1 = tmock(initializers);
    const mock2 = tmock('', initializers);

    // ASSERT
    const unmockedInitializers = {
      a: 1,
      b: 3,
    };
    expect(tunmock(mock1)).toEqual(unmockedInitializers);
    expect(tunmock(mock2)).toEqual(unmockedInitializers);
  });

  test('should accept options as first or second or third argument', () => {
    // ARRANGE
    expect(tglobalopt().automock).toBe(true);
    const options: TmockOptions = { automock : false };

    // ACT
    const mock1 = tmock(options);
    const mock2 = tmock('', options);
    const mock3 = tmock('', [], options);
    mock1.a;
    mock2.a;
    mock3.a;

    // ASSERT
    expect(tunmock(mock1).a).toBeUndefined();
    expect(tunmock(mock2).a).toBeUndefined();
    expect(tunmock(mock3).a).toBeUndefined();
  });

  test('should accept generic form', () => {
    // ARRANGE
    interface I {
      a: number;
      b: { c: string };
    }

    // ACT + ASSERT
    tm.mock<I>('', [{ a: 1 }]),
    tm.mock<Object>('', [[(m) => m.toString, () => '']]),
    tm.mock<I>('', [
      { a: 1 },
      [(m) => m.a, 1],
    ]);
    tm.mock<I>([{ a: 1 }]),
    tm.mock<I>([[(m) => m.a, 1]]),
    tm.mock<I>([
      { a: 1 },
      [(m) => m.a, 1],
    ]);
    const mock = tm.mock<I>();
    mock.b.c;
  });

  test('should throw when more then one initializer argument provided', () => {
    expect(() => tmock([], [])).toThrowError('tmock: multiple initializer arguments not allowed');
  });

  test('should throw when more then one options argument provided', () => {
    expect(() => tmock({}, {})).toThrowError('tmock: multiple options arguments not allowed');
    expect(() => tmock('', {}, {})).toThrowError('tmock: multiple options arguments not allowed');
  });
});

describe('----------------------- tmock options ------------------------', () => {
  describe('externalMock', () => {
    test('should consider calls of explicitly defined functions', () => {
      // ARRANGE
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
      ], { externalMock: jestMock });

      // ACT
      mock.f2();
      mock.p.f3();
      mock.p.f3(1);
      mock.p.f3(() => undefined, undefined);
      mock.f4[0](true, false);
      mock.p.f5('');
      mock.f6();

      // ASSERT
      const res = tunmock(mock)
      expect(tinfo(res.f1).externalMock).not.toBeCalled();
      expect(tinfo(res.f2).externalMock).toBeCalledTimes(1);
      expect(tinfo(res.p.f3).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(res.f4[0]).externalMock.mock.calls).toEqual([[true, false]]);
      expect(tinfo(res.p.f5).externalMock.mock.calls).toEqual([['']]);
      expect(tinfo(res.f6).externalMock).toBeCalledTimes(1);
    });

    test('should consider calls of functions that were not explicitly defined', () => {
      // ARRANGE
      const mock = tmock({ externalMock: jestMock });

      // ACT
      mock.f1();
      mock.p.f2();
      mock.p.f2(1);
      mock.p.f2(() => undefined, undefined);
      mock.q[0](true, false);

      // ASSERT
      const res = tunmock(mock);
      expect(tinfo(res.f1).externalMock).toBeCalledTimes(1);
      expect(tinfo(res.p.f2).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(res.q[0]).externalMock.mock.calls).toEqual([[true, false]]);
    });
  });

  describe('simplifiedOutput and simplificationThreshold', () => {
    test.each([
      [1, 'mock(1)', 'mock(1)'],
      [{}, 'mock({})', 'mock({...})'],
      [{ '0': 7 }, 'mock({0: 7})', 'mock({...})'],
      [{ a: '7', b: 0 }, `mock({a: '7', b: 0})`, 'mock({...})'],
      [[], 'mock([])', 'mock([...])'],
      [[1], 'mock([1])', 'mock([...])'],
      [[`1`, true, {}], `mock(['1', true, {}])`, 'mock([...])'],
    ])('should simplify output %#', (arg, expectedResult, expectedResultSimplified) => {
      // ARRANGE
      const mock = tm.mock({ simplifiedOutput: false });
      const mockSimplifiedOutput = tm.mock({ simplifiedOutput: true });

      // ACT
      const res = mock(arg);
      const resSimple = mockSimplifiedOutput(arg);

      // ASSERT
      expect(tm.unmock(res)).toEqual(expectedResult);
      expect(tm.unmock(resSimple)).toEqual(expectedResultSimplified);
    });

    test('should simplify arguments-mocks when stringified mock length exceeds simplification threshold when threshold is zero', () => {
      // ARRANGE
      tglobalopt({ simplifiedOutput: true, simplificationThreshold: 0 });
      const mock = tmock();
      const mockNameLength0 = tmock('');
      const mockNameLength1 = tmock('m');

      // ACT + ASSERT
      expect(tunmock(mock(mockNameLength0))).toBe('mock(<unnamed mock>)');
      expect(tunmock(mock(mockNameLength1))).toBe('mock(<...>)');
    });

    test('should simplify arguments-mocks when stringified mock length exceeds simplification threshold when threshold is positive', () => {
      // ARRANGE
      tglobalopt({ simplifiedOutput: true, simplificationThreshold: 10 });
      const mock = tmock();

      // ACT + ASSERT
      expect(tunmock(mock(mock.fff()))).toBe('mock(mock.fff())');
      expect(tunmock(mock(mock.ffff()))).toBe('mock(<...>)');
    });
  });

  describe('automock', () => {
    test('should return proxy when automock enabled for not explicitly mocked', () => {
      // ACT
      const mock = tmock({ automock: true });

      // ASSERT
      expect(typeof mock.a).toBe('function');
    });

    test('should return undefined when automock disabled for not explicitly mocked', () => {
      // ACT
      const mock = tmock({ automock: false });

      // ASSERT
      expect(mock.a).toBeUndefined();
    });
  });

  test('should add prefix to auto mocked values', () => {
    // ARRANGE
    const mock = tmock({ autoValuesPrefix: 'value from ' });

    // ACT
    const result = tunmock(mock());

    // ASSERT
    expect(result).toBe('value from mock()');
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
    const mock = tm.mock();

    // ACT
    mock();

    // ASSERT
    const res = tm.unmock(mock);
    expect(res).toEqual(expect.any(Function));
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
  ])('should return predefined scalars, objects and arrays %#', (initialStub) => {
    // ARRANGE
    const mock = tm.mock([{ a: initialStub }]);

    // ACT + ASSERT
    expect(mock.a).toEqual(initialStub);
  });

  test('should return predefined jest mocks as is', () => {
    // ARRANGE
    const jestMock = jest.fn();
    const mock = tm.mock([{ a: jestMock }]);

    // ACT + ASSERT
    expect(mock.a).toBe(jestMock);
  });

  test('should return predefined classes as is', () => {
    // ARRANGE
    class A {};
    const a = new A();
    const mock = tm.mock([{
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
    const mock = tm.mock([{ f: initialStub }]);

    // ASSERT
    expect(mock.f()).toBe(DFAULT_NUMERIC_VALUE);
    expect(mock.f.a).toBe(3);
    expect(mock.f[s]).toBe('sss');
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should preserve assigned values as is', (val) => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock.a = val;

    // ASSERT
    expect(mock.a).toBe(val);
  });

  test('values assigned to mock should override predefined values', () => {
    // ARRANGE
    const mock = tm.mock([{ a: 1 }]);
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
    const mock = tm.mock();

    // ACT
    mock.a.b.c = null;
    mock.a(1).b.c = [1];

    // ASSERT
    expect(mock.a.b.c).toBe(null);
    expect(mock.a(1).b.c).toEqual([1]);
    const res = tm.unmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a.b.c).toBe(null);
    expect(res.a(1).b.c).toEqual([1]);
  });

  test('mock should allow to call function and then assign function properties', () => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock.a(1).b.c = [1];
    mock.a.b.c = null;

    // ASSERT
    expect(mock.a(1).b.c).toEqual([1]);
    expect(mock.a.b.c).toBe(null);
    const res = tm.unmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a(1).b.c).toEqual([1]);
    expect(res.a.b.c).toBe(null);
  });

  test('should call both original function and external mock', () => {
    // ARRANGE
    const mock = tmock([{ f: jest.fn() }], { externalMock: jestMock });
    // tset(mock, [(m) => m.f(7), 3]); // TODO: explore this case

    // ACT
    mock.f();
    mock.f(7);

    // ASSERT
    const res = tunmock(mock);

    expect(res.f).toBeCalledTimes(2);
    expect(tinfo(res.f).externalMock).toBeCalledTimes(2);
  });

  test('should return empty array for spread operator', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    const res = [...mock];

    // ASSERT
    expect(res).toEqual([]);
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
    const stub = tm.stub([(s) => s.a, 1]);

    // ASSERT
    expect(stub).toEqual({ a: 1 });
  });

  test('should accept generic form', () => {
    // ARRANGE
    interface I {
      a: number;
      b: string;
    }
    // ASSERT
    tm.stub<string>([(s) => s.length, 1]);
    tm.stub<I>({ b: '1' });
    tm.stub<I>([
      { a: 1 },
      [(s) => s.b, 'a'],
    ]);
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should replace values', (originalValue) => {
    // ACT
    const stub = tm.stub([
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
    const stub = tm.stub([
      [(s) => s.a, 1],
      [(s) => s.a.aa, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toEqual({ aa: 'aa' });
  });

  test('should replece all prior setups', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.a.aa, {} ],
      [(s) => s.a.aa.aaa, 1 ],
      [(s) => s.a.bb, 3 ],
      [(s) => s.a, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toBe('aa');
  });

  test('should merge to objects', () => {
    // ACT
    const stub = tm.stub([
      {
        a: { aa: 1, bb: 3, cc: { ccc: 5 }},
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

  test('should combine return values of functions in stub', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.f(1), 5],
      [(s) => s.f(3), 7],
      [(s) => s.g(1, 3), 'bbb'],
      [(s) => s.g(TM_ANY), 'aaa'],
    ]);

    // ASSERT
    expect(stub.f(1)).toBe(5);
    expect(stub.f(3)).toBe(7);
    expect(stub.f()).toBe(undefined);

    expect(stub.g(1, 3)).toBe('bbb');
    expect(stub.g(1)).toBe('aaa');
  });

  test('should merge return values and properties of functions in stub', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.f.prop1, '1'],
      [(s) => s.f(1), { b: 3 }],
      [(s) => s.f(1).a.bb, 5],
      [(s) => s.f.prop2, null],

      [(s) => s.f1, function () { return 1; }],
      [(s) => s.f1.prop, 7 ],
      [(s) => s.f1(), 'aaa' ],
    ]);

    // ASSERT
    expect(stub.f(1)).toEqual({
      a: {
        bb: 5,
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
    const stub = tm.stub([
      [s => s(), 1],
    ]);

    // ASSERT
    expect(stub()).toBe(1);
  });

  test('should throw error when trying to replace stub at root level', () => {
    // ASSERT
    expect(() => tm.stub([(s) => s, 1])).toThrowError('Cannot replace stab root');
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
    [new Function(), 'mock(<function>)'],
    [() => undefined, 'mock(<arrow function>)'],
    [function () { return null; }, 'mock(<function>)'],
    [function f() { return null; }, 'mock(<function>)'],
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
          prop1: 'mock',
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
        'mock',
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
    mock.g()[s] = '3';

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res.f).toStrictEqual(expect.any(Function));
    expect(res.f()).toBe(1);
    expect(res.f.prop).toBe(1);
    //expect(res.f[s]).toBe('1'); // TODO: support symbols
    expect(res.g).toStrictEqual(expect.any(Function));
    expect(res.g.prop).toBe(3);
    //expect(res.g[s]).toBe('3'); // TODO: support symbols
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
        a: 'mock',
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
      a: 'mock',
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
    expect(() => tunmock(child)).not.toThrowError();
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
    expect(() => tset(mock, [(m) => m, 1])).toThrowError('Mocking at root level is not allowed');
  });

  test.each([
    (m) => m.a,
    (m) => m.a.b.c,
    (m) => m.b[3],
    (m) => m(),
    (m) => m()(),
    (m) => m.f(),
    (m) => m.a.f(),
    (m) => m.f().a,
    (m) => m.f().g(),
    (m) => m.f()(),
    (m) => m.f()().a,
    (m) => m.f().a.g().h,
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
    ...OBJECTS_AND_ARRAYS,
    new RegExp(''),
  ])('should return mock values for scalars, objects, arrays and classes', (value) => {
    // ARRANGE
    const mock = tm.mock();
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
    const mock = tm.mock();
    tset(mock, [(m) => m.a, f]);

    // ACT
    mock.a();
    const result = mock.a();

    // ASSERT
    expect(result).toBe(1);
    expect(jestFunction).toBeCalledTimes(2);
  });

  test('should override values', () => {
    // ARRANGE
    const mock = tm.mock([{ a: 0 }]);

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
    expect(() => mock.f()()).toThrowError('mock.f(...) is not a function');
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

  test('mocked function should return predefined values for particular arguments, otherwise automock value', () => {
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
    expect(res.f('b')).toBe(`mock.f('b')`);
  });

  test('should mock call result per set of call arguments', () => {
    // ARRANGE
    const mock = tm.mock();

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
    expect(() => tset(mock, [(m) => m.prop, child])).not.toThrowError();
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
    expect(() => mock.replacedFunc()).toThrowError();

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
    const mock = tm.mock([{
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
    let res = tm.unmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: {
        aa: {
          aaa: 'mock.a.aa.aaa',
          aaa1: 'mock.a.aa.aaa1',
        },
        aa1: {
          aaa: 'mock.a.aa1.aaa',
        },
        e: 9,
      },
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock.a.aa);
    res = tm.unmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: {
        aa: 'mock.a.aa',
        aa1: {
          aaa: 'mock.a.aa1.aaa',
        },
        e: 9,
      },
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock.a);
    res = tm.unmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: false,
      added: 'value',
      a: 'mock.a',
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock);
    res = tm.unmock(mock);
    expect(res).toEqual({
      untouched: 7,
      replaced: true,
    });
  });

  test('should erase mocks first touched by sut then setup by tset', () => {
    // ARRANGE
    // Create mock.
    const mock = tm.mock();

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
    res = tm.unmock(mock);
    expect(res).toEqual({
      replaced1: 'original1',
      replaced2: 'original2',
    });
  });

  test('should erase return values per arguments added by sut', () => {
    // ARRANGE
    const mock = tm.mock([
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
    treset();
    const mock1 = tmock('mock1', [{ f: function fff() {} }], { simplifiedOutput: false });
    const mock2 = tmock('mock2', { simplifiedOutput: false });

    // ACT
    const mock3 = mock1.prop.f(Infinity);
    mock1.f();
    mock2.f();
    mock1.prop.f();
    mock2(function () {}, [1], {'0': 1});
    mock1.prop.f(Infinity).prop.f2([]);

    // ASSERT
    expect(tinfo().callLog).toEqual([
      'mock1.prop.f(Infinity)',
      'mock1.f()',
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
      'mock2.f()',
      'mock2(<function>, [1], {0: 1})',
    ]);

    // Reset mock1.prop.f(Infinity).
    treset(mock3);
    expect(tinfo().callLog).toEqual([
      'mock1.f()',
      'mock2.f()',
      'mock1.prop.f()',
      'mock2(<function>, [1], {0: 1})',
    ]);
    expect(tinfo(mock1).callLog).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tinfo(mock2).callLog).toEqual([
      'mock2.f()',
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
      aaa: 'mock.aaa',
    });
    expect(res2).toEqual({
      bbb: 'mock.bbb',
    });
  });
});

describe('----------------- tinfo ------------------', () => {
  describe('externalMock', () => {
    test.each([
      ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE, jest.fn(() => DFAULT_NUMERIC_VALUE),
    ])('should setup externalMock property for functions if externalMock argument is provided %#', (initialStub) =>
    {
      // ACT
      const mock = tm.mock([{ f: initialStub }], { externalMock: jestMock });

      // ASSERT
      //const res = tm.unmock(mock);
      expect(tinfo(mock.f).externalMock).toBeDefined();
    });

    test.each([
      ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE, jest.fn(() => DFAULT_NUMERIC_VALUE),
    ])('should not setup externalMock property for functions if externalMock argument is not provided %#', (initialStub) =>
    {
      // ACT
      const mock = tm.mock([{ f: initialStub }]);

      // ASSERT
      //const res = tm.unmock(mock);
      expect(tinfo(mock.f).externalMock).toBeUndefined();
    });

    test('should accept mock as argument', () => {
      // ARRANGE
      const mock = tmock({ externalMock: jestMock });

      // ACT
      mock.f();

      // ASSERT
      expect(tinfo(mock.f).externalMock).toBeCalledTimes(1);
    });
  });

  describe('callLog', () => {
    test('should return only mock calls when mock argument is provided, otherwise all calls', () => {
      // ARRANGE
      treset();
      const mock1 = tmock('mock1', [{ f: function fff() {} }]);
      const mock2 = tmock('mock2', [{ f: function fff() {} }]);

      // ACT
      mock1.f();
      mock1.f(NaN);
      mock2.f();
      mock1.g();
      mock2();
      mock2.f1('1');
      mock2.f1(1).f2(2);
      mock2.f1(1).f2(2).f3(null, Symbol());

      // ASSERT
      expect(tinfo().callLog).toEqual([
        'mock1.f()',
        'mock1.f(NaN)',
        'mock2.f()',
        'mock1.g()',
        'mock2()',
        `mock2.f1('1')`,
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1).f2(2).f3(null, Symbol())',
      ]);
      expect(tinfo(mock1).callLog).toEqual([
        'mock1.f()',
        'mock1.f(NaN)',
        'mock1.g()',
      ]);
      expect(tinfo(mock2).callLog).toEqual([
        'mock2.f()',
        'mock2()',
        `mock2.f1('1')`,
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1)',
        'mock2.f1(1).f2(2)',
        'mock2.f1(1).f2(2).f3(null, Symbol())',
      ]);
    });

    test('should not wrap mocks into quotes', () => {
      // ARRANGE
      function f(arg1, arg2) {
        arg1(arg2.prop.p);
      }
      const mock1 = tmock('mock1', { simplifiedOutput: false });
      const mock2 = tmock('mock2', { simplifiedOutput: false });
      f(mock1, mock2);

      // ACT
      const res = tinfo(mock1).callLog;

      // ASSERT
      expect(res).toEqual(['mock1(mock2.prop.p)']);
    });

    test('should filter calls', () => {
      // ARRANGE
      function f(arg1) {
        arg1;
        arg1.a;
        arg1();
        arg1.a.f();
        arg1.fff();
        arg1.fff(arg1.fff(7));
      }
      const mock1 = tmock('mock1');
      f(mock1);

      // ASSERT
      expect(tinfo(mock1).callLog).toEqual(['mock1()', 'mock1.a.f()', 'mock1.fff()', 'mock1.fff(7)', 'mock1.fff(mock1.fff(7))']);
      expect(tinfo(mock1.a).callLog).toEqual(['mock1.a.f()']);
      expect(tinfo(mock1.a.f).callLog).toEqual(['mock1.a.f()']);
      expect(tinfo(mock1.fff).callLog).toEqual(['mock1.fff()', 'mock1.fff(7)', 'mock1.fff(mock1.fff(7))']);
    });
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
});
