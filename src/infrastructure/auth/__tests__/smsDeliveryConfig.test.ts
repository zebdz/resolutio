import { describe, it, expect } from 'vitest';
import {
  resolveSmsDeliveryConfig,
  smsDeliveryDisplayKeys,
} from '../smsDeliveryConfig';

describe('resolveSmsDeliveryConfig', () => {
  it('reports stub channel when apiId is absent', () => {
    expect(resolveSmsDeliveryConfig({}).channelActive).toBe(false);
  });

  it('reports active channel when apiId is present', () => {
    expect(resolveSmsDeliveryConfig({ apiId: 'abc123' }).channelActive).toBe(
      true
    );
  });

  it('parses a numeric max cost', () => {
    const c = resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '10' });
    expect(c.maxCostRubles).toBe(10);
    expect(c.maxCostInvalid).toBe(false);
  });

  it('accepts a decimal max cost', () => {
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '2.5' }).maxCostRubles
    ).toBe(2.5);
  });

  it('treats empty or absent max cost as no limit (null)', () => {
    expect(resolveSmsDeliveryConfig({ apiId: 'x' }).maxCostRubles).toBeNull();
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '' }).maxCostRubles
    ).toBeNull();
  });

  it('flags a non-numeric max cost as invalid and falls back to no limit', () => {
    const c = resolveSmsDeliveryConfig({ apiId: 'x', maxCost: 'abc' });
    expect(c.maxCostRubles).toBeNull();
    expect(c.maxCostInvalid).toBe(true);
  });

  it('parses test mode from the string "true" only', () => {
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', testMode: 'true' }).testMode
    ).toBe(true);
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', testMode: 'false' }).testMode
    ).toBe(false);
    expect(resolveSmsDeliveryConfig({ apiId: 'x' }).testMode).toBe(false);
  });
});

describe('smsDeliveryDisplayKeys', () => {
  const active = {
    channelActive: true,
    testMode: false,
    maxCostRubles: null as number | null,
    maxCostInvalid: false,
  };

  it('maps stub channel to channelStub and N/A rows', () => {
    expect(smsDeliveryDisplayKeys({ ...active, channelActive: false })).toEqual(
      {
        channelKey: 'channelStub',
        testModeKey: 'notApplicable',
        maxCostKey: 'notApplicable',
      }
    );
  });

  it('maps active + no cap to no-limit', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostRubles: null }).maxCostKey
    ).toBe('maxCostNoLimit');
  });

  it('maps active + numeric cap to value', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostRubles: 10 }).maxCostKey
    ).toBe('maxCostValue');
  });

  it('maps active + invalid to invalid', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostInvalid: true }).maxCostKey
    ).toBe('maxCostInvalid');
  });

  it('maps test mode on/off when active', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, testMode: true }).testModeKey
    ).toBe('on');
    expect(
      smsDeliveryDisplayKeys({ ...active, testMode: false }).testModeKey
    ).toBe('off');
  });

  it('maps active channel to channelActive', () => {
    expect(smsDeliveryDisplayKeys(active).channelKey).toBe('channelActive');
  });
});
