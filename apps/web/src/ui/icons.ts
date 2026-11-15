export { BookOpen, CircleExclamationPoint as AlertIcon, SatelliteDish, Microscope, Rocket, Wrench, PanelRightOpen, Orbit, Gauge, Volume2, ShieldCheck, Sun, Send, Pause, Play, ChevronRight, ChevronLeft, Settings, Languages, X, Star, Check, Plus, Minus, RotateCcw, ArrowUpRight, Satellite, Battery, Box, Radio, Zap, Search, FileText } from 'lucide-react';
import { Microscope, Wrench, Rocket, SatelliteDish, Battery, Sun, Box, Radio, Gauge, Thermometer } from 'lucide-react';
import type { RoleId,PartCategory } from '@astrix/core';
export const roleIcons={SCIENCE:Microscope,SPACECRAFT:Wrench,LAUNCH_ORBIT:Rocket,GROUND_COMMS:SatelliteDish} satisfies Record<RoleId,typeof Microscope>;
export const partIcons={BATTERY:Battery,SOLAR:Sun,COMPUTER:Box,STORAGE:Box,ADCS:Gauge,RADIO:Radio,INSTRUMENT:Microscope,PROPULSION:Rocket,THERMAL:Thermometer} satisfies Record<PartCategory,typeof Battery>;
