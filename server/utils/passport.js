// @flow
import { addMinutes, subMinutes } from "date-fns";
import fetch from "fetch-with-proxy";
import { type Request } from "koa";
import { OAuthStateMismatchError } from "../errors";
import { getCookieDomain } from "./domains";

function randomState(){
  // taken from: https://medium.com/@dazcyril/generating-cryptographic-random-state-in-javascript-in-the-browser-c538b3daae50
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let array = new Uint8Array(40);
  window.crypto.getRandomValues(array);
  array = array.map(x => validChars.charCodeAt(x % validChars.length));
  const randomState = String.fromCharCode.apply(null, array);
  return randomState
}

export class StateStore {
  key: string = "state";

  store = (req: Request, callback: (err: ?Error, state?: string) => void) => {
    const state = randomState();

    // $FlowFixMe
    req.cookies.set(this.key, state, {
      httpOnly: false,
      expires: addMinutes(new Date(), 10),
      domain: getCookieDomain(req.hostname),
    });

    callback(null, state);
  };

  verify = (
    req: Request,
    providedState: string,
    callback: (err: ?Error, ?boolean) => void
  ) => {
    // $FlowFixMe
    const state = req.cookies.get(this.key);
    if (!state) {
      return callback(
        new OAuthStateMismatchError("State not return in OAuth flow")
      );
    }

    // $FlowFixMe
    req.cookies.set(this.key, "", {
      httpOnly: false,
      expires: subMinutes(new Date(), 1),
      domain: getCookieDomain(req.hostname),
    });

    if (state !== providedState) {
      return callback(new OAuthStateMismatchError());
    }

    callback(null, true);
  };
}

export async function request(endpoint: string, accessToken: string) {
  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
}
