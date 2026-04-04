// src/constants/countries.ts
import { countries } from "countries-list";

export const COUNTRIES: string[] = Object.values(countries)
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b));