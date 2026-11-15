import { create } from 'zustand';
import type { Budgets } from '@astrix/core';
/** Presentation-only quote; never a design or command authority. */
export const useProposal = create<{before:Budgets|null;after:Budgets|null;revision:number|null;set:(before:Budgets,after:Budgets,revision:number)=>void;clear:()=>void}>(set=>({before:null,after:null,revision:null,set:(before,after,revision)=>set({before,after,revision}),clear:()=>set({before:null,after:null,revision:null})}));
