/** Address components retain their distinct meaning after boundary validation.
 * House/flat registry references validate FIAS GUIDs separately from free-text address parts. */
import { z } from 'zod';
import { identifier } from '../shared/Identifier';

function component<const Brand extends string>(brand: Brand) {
  return z.string().trim().min(1).brand(brand);
}

export const CountryName = component('CountryName');
export type CountryName = z.infer<typeof CountryName>;
export const RegionName = component('RegionName');
export type RegionName = z.infer<typeof RegionName>;
export const CityName = component('CityName');
export type CityName = z.infer<typeof CityName>;
export const StreetName = component('StreetName');
export type StreetName = z.infer<typeof StreetName>;
export const BuildingNumber = component('BuildingNumber');
export type BuildingNumber = z.infer<typeof BuildingNumber>;
export const ApartmentNumber = component('ApartmentNumber');
export type ApartmentNumber = z.infer<typeof ApartmentNumber>;
export const PostalCode = component('PostalCode');
export type PostalCode = z.infer<typeof PostalCode>;
export const AddressLine = component('AddressLine');
export type AddressLine = z.infer<typeof AddressLine>;
export const HouseFiasId = identifier(
  'HouseFiasId',
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);
export type HouseFiasId = z.infer<typeof HouseFiasId>;
export const FlatFiasId = identifier(
  'FlatFiasId',
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);
export type FlatFiasId = z.infer<typeof FlatFiasId>;
