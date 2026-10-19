'use client';
import { createContext, useContext } from 'react';

/** Tells every MediaView below it which live room it is rendering for, so a player with only a room token (no account) or the room's host
 *  can load that room's media. Outside a room (library preview, editor) the scope is null and only owner / published-quiz access applies. */
const MediaScopeContext = createContext<string | null>(null);
export const MediaScope = MediaScopeContext.Provider;
export const useMediaRoom = () => useContext(MediaScopeContext);
