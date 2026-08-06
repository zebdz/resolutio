import { describe, it, expect } from 'vitest';
import { Address, AddressDomainCodes } from '../Address';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

describe('Address', () => {
  const validProps = {
    country: 'Russia',
    city: 'Moscow',
    street: 'Tverskaya',
    building: '12',
    isPrivateHouse: true,
  };

  describe('create', () => {
    it('should create address with all required fields', () => {
      const address = Address.create(validProps);

      expect(address.country).toBe('Russia');
      expect(address.city).toBe('Moscow');
      expect(address.street).toBe('Tverskaya');
      expect(address.building).toBe('12');
      expect(address.region).toBeUndefined();
      expect(address.apartment).toBeUndefined();
      expect(address.postalCode).toBeUndefined();
    });

    it('should create address with all optional fields', () => {
      const address = Address.create({
        ...validProps,
        // This test is about the apartment value surviving create() —
        // isPrivateHouse: true (from validProps) would null it out
        isPrivateHouse: false,
        region: 'Moscow Oblast',
        apartment: '45',
        postalCode: '125009',
      });

      expect(address.region).toBe('Moscow Oblast');
      expect(address.apartment).toBe('45');
      expect(address.postalCode).toBe('125009');
    });

    it('should handle Russian building formats', () => {
      const addr1 = Address.create({ ...validProps, building: '3/1' });
      expect(addr1.building).toBe('3/1');

      const addr2 = Address.create({ ...validProps, building: '5 к.1' });
      expect(addr2.building).toBe('5 к.1');

      const addr3 = Address.create({ ...validProps, building: '10 стр.2' });
      expect(addr3.building).toBe('10 стр.2');
    });

    it('should throw when country is empty', () => {
      expect(() => Address.create({ ...validProps, country: '' })).toThrow(
        AddressDomainCodes.COUNTRY_REQUIRED
      );
    });

    it('should throw when country is whitespace', () => {
      expect(() => Address.create({ ...validProps, country: '   ' })).toThrow(
        AddressDomainCodes.COUNTRY_REQUIRED
      );
    });

    it('should throw when city is empty', () => {
      expect(() => Address.create({ ...validProps, city: '' })).toThrow(
        AddressDomainCodes.CITY_REQUIRED
      );
    });

    it('should throw when street is empty', () => {
      expect(() => Address.create({ ...validProps, street: '' })).toThrow(
        AddressDomainCodes.STREET_REQUIRED
      );
    });

    it('should throw when building is empty', () => {
      expect(() => Address.create({ ...validProps, building: '' })).toThrow(
        AddressDomainCodes.BUILDING_REQUIRED
      );
    });
  });

  describe('profanity checks', () => {
    const profaneChecker: ProfanityChecker = {
      containsProfanity: (text: string) =>
        text.toLowerCase().includes('badword'),
    };

    it('should throw when country contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, country: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should throw when city contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, city: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should throw when street contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, street: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should throw when building contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, building: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should throw when region contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, region: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should throw when apartment contains profanity', () => {
      expect(() =>
        Address.create({ ...validProps, apartment: 'Badword' }, profaneChecker)
      ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
    });

    it('should not check profanity when checker is not provided', () => {
      const address = Address.create(validProps);
      expect(address.country).toBe('Russia');
    });

    it('should not throw for optional fields when undefined', () => {
      expect(() => Address.create(validProps, profaneChecker)).not.toThrow();
    });
  });

  describe('equals', () => {
    it('should return true for same address', () => {
      const a = Address.create(validProps);
      const b = Address.create(validProps);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false when any field differs', () => {
      const a = Address.create(validProps);
      const b = Address.create({ ...validProps, building: '13' });
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toPlain', () => {
    it('should serialize to plain object', () => {
      const address = Address.create({
        ...validProps,
        // This test is about apartment round-tripping through toPlain() —
        // isPrivateHouse: true (from validProps) would null it out
        isPrivateHouse: false,
        region: 'Oblast',
        apartment: '5',
        postalCode: '123456',
      });

      const plain = address.toPlain();

      expect(plain).toEqual({
        country: 'Russia',
        region: 'Oblast',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
        apartment: '5',
        postalCode: '123456',
        isPrivateHouse: false,
      });
    });

    it('should omit undefined optional fields', () => {
      const address = Address.create(validProps);
      const plain = address.toPlain();

      expect(plain.region).toBeUndefined();
      expect(plain.apartment).toBeUndefined();
      expect(plain.postalCode).toBeUndefined();
    });
  });

  describe('apartment requirement', () => {
    it('should throw when not a private house and apartment is missing', () => {
      expect(() =>
        Address.create({ ...validProps, isPrivateHouse: false })
      ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
    });

    it('should throw when not a private house and apartment is blank', () => {
      expect(() =>
        Address.create({
          ...validProps,
          isPrivateHouse: false,
          apartment: '   ',
        })
      ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
    });

    it('should default isPrivateHouse to false when the flag is absent', () => {
      // Built inline, NOT from validProps — validProps carries
      // isPrivateHouse: true, which would defeat the point of this test
      expect(() =>
        Address.create({
          country: 'Russia',
          city: 'Moscow',
          street: 'Tverskaya',
          building: '12',
        })
      ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
    });

    it('should allow a missing apartment for a private house', () => {
      const address = Address.create({ ...validProps, isPrivateHouse: true });

      expect(address.isPrivateHouse).toBe(true);
      expect(address.apartment).toBeUndefined();
    });

    it('should force apartment to undefined for a private house', () => {
      const address = Address.create({
        ...validProps,
        isPrivateHouse: true,
        apartment: '12',
      });

      expect(address.apartment).toBeUndefined();
    });

    it('should accept an apartment when not a private house', () => {
      const address = Address.create({
        ...validProps,
        isPrivateHouse: false,
        apartment: '12',
      });

      expect(address.apartment).toBe('12');
      expect(address.isPrivateHouse).toBe(false);
    });
  });

  describe('provenance', () => {
    // Every case here is a real flat, so isPrivateHouse is explicitly false —
    // inheriting validProps' true would null out the apartment under test
    const flatProps = { ...validProps, isPrivateHouse: false, apartment: '2' };

    it('should store DaData provenance fields', () => {
      const address = Address.create({
        ...flatProps,
        oneLine:
          '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
        houseFiasId: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        flatFiasId: '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee',
      });

      expect(address.apartment).toBe('2');
      expect(address.oneLine).toContain('Гвардейский пер');
      expect(address.houseFiasId).toBe('c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5');
      expect(address.flatFiasId).toBe('9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee');
    });

    it('should treat two addresses differing only by flatFiasId as unequal', () => {
      const a = Address.create({ ...flatProps, flatFiasId: 'aaa' });
      const b = Address.create({ ...flatProps, flatFiasId: 'bbb' });

      expect(a.equals(b)).toBe(false);
    });
  });
});
