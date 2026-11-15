import { Battery, Camera, Compass, Cpu, Database, Flame, Radio, Rocket, Sun, type LucideIcon } from 'lucide-react';
import type { PartDef } from '@astrix/core';

export const partIcons: Record<PartDef['category'], LucideIcon> = { BATTERY: Battery, SOLAR: Sun, COMPUTER: Cpu, STORAGE: Database, ADCS: Compass, RADIO: Radio, INSTRUMENT: Camera, PROPULSION: Rocket, THERMAL: Flame };
