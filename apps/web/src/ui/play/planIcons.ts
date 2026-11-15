import { BatteryCharging, Camera, CornerDownLeft, Flag, Navigation, Orbit, Radio, Rocket, Square, Target, Wrench, type LucideIcon } from 'lucide-react';
import type { TurnPlanKind } from '@astrix/core';

/** One icon per turn plan kind, shared by the action dock, turn cards and the report timeline. */
export const planIcons:Record<TurnPlanKind,LucideIcon>={LAUNCH:Rocket,MANEUVER:Navigation,COAST:Orbit,OBSERVE:Camera,TRANSMIT:Radio,RECHARGE:BatteryCharging,RECOVER:Wrench,CAPTURE:Target,RETURN:CornerDownLeft,FINISH:Flag,ABORT:Square};
