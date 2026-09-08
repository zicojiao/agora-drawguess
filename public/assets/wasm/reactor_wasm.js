/* @ts-self-types="./reactor_wasm.d.ts" */

/**
 * The Reactor client, as JavaScript sees it.
 *
 * ```js
 * import init, { ReactorClient } from "@reactor-team/reactor-wasm";
 *
 * await init();
 * const client = new ReactorClient({ modelName: "my-model" }, () => getToken());
 * client.onStatusChanged((status) => console.log(status));
 * client.onTrackReceived((name, mid) => {
 *   video.srcObject = client.getStreamByMid(mid);
 * });
 * await client.connect();
 * await client.sendCommand("set_prompt", { prompt: "a cat" });
 * ```
 */
export class ReactorClient {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ReactorClientFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_reactorclient_free(ptr, 0);
    }
    /**
     * The runtime's capabilities, or `undefined` before they arrive.
     * @returns {Capabilities | undefined}
     */
    capabilities() {
        const ret = wasm.reactorclient_capabilities(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Create (or adopt) a session and bring up the transport.
     * @param {ConnectOptions | null} [options]
     * @returns {Promise<void>}
     */
    connect(options) {
        const ret = wasm.reactorclient_connect(this.__wbg_ptr, isLikeNone(options) ? 0 : addToExternrefTable0(options));
        return ret;
    }
    /**
     * Tear down the transport and end the session server-side — unless this
     * client only adopted the session, in which case it stays alive for
     * whoever created it.
     * @returns {Promise<void>}
     */
    disconnect() {
        const ret = wasm.reactorclient_disconnect(this.__wbg_ptr);
        return ret;
    }
    /**
     * The live `RTCPeerConnection` — for `getStats()`, or anything else the
     * binding does not wrap. `undefined` before the first connect.
     * @returns {RTCPeerConnection | undefined}
     */
    getPeerConnection() {
        const ret = wasm.reactorclient_getPeerConnection(this.__wbg_ptr);
        return ret;
    }
    /**
     * The `MediaStream` a received track arrived on — what a `<video>` or
     * `<audio>` element's `srcObject` wants.
     * @param {string} mid
     * @returns {MediaStream | undefined}
     */
    getStreamByMid(mid) {
        const ptr0 = passStringToWasm0(mid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_getStreamByMid(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * The stream of a received track, by declared name.
     * @param {string} name
     * @returns {MediaStream | undefined}
     */
    getStreamByName(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_getStreamByName(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * A received track by its SDP mid, as reported by `onTrackReceived`.
     * @param {string} mid
     * @returns {MediaStreamTrack | undefined}
     */
    getTrackByMid(mid) {
        const ptr0 = passStringToWasm0(mid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_getTrackByMid(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * A received track by its declared name.
     *
     * Useful when the track arrived before the listener was registered — a
     * component that mounts mid-connect misses the event but not the track.
     * @param {string} name
     * @returns {MediaStreamTrack | undefined}
     */
    getTrackByName(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_getTrackByName(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * The last error, in the shape the `onError` listener receives.
     * @returns {ReactorError | undefined}
     */
    lastError() {
        const ret = wasm.reactorclient_lastError(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Create a client.
     *
     * * `options` — see the `ClientOptions` fields; `modelName` is required.
     * * `jwt` — a token string, a `() => string | Promise<string>` resolver
     *   called before every authenticated request, or `null` for an
     *   unauthenticated local runtime. Replaceable later with `setJwt`.
     * @param {ClientOptions} options
     * @param {JwtSource | null} [jwt]
     */
    constructor(options, jwt) {
        const ret = wasm.reactorclient_new(options, isLikeNone(jwt) ? 0 : addToExternrefTable0(jwt));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        ReactorClientFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * `(capabilities: { protocolVersion, tracks, commands? }) => void`
     * @param {CapabilitiesListener} listener
     */
    onCapabilitiesReceived(listener) {
        wasm.reactorclient_onCapabilitiesReceived(this.__wbg_ptr, listener);
    }
    /**
     * `(error: { code, message, recoverable, timestampMs, status?, operation?,
     * retryAfterMs? }) => void`
     * @param {ErrorListener} listener
     */
    onError(listener) {
        wasm.reactorclient_onError(this.__wbg_ptr, listener);
    }
    /**
     * `(message: { type, data }) => void` — application messages from the model.
     * @param {MessageListener} listener
     */
    onMessage(listener) {
        wasm.reactorclient_onMessage(this.__wbg_ptr, listener);
    }
    /**
     * `(message: { type, data }) => void` — platform messages: moderation,
     * recording lifecycle, and the rest of the runtime's own traffic.
     * @param {MessageListener} listener
     */
    onRuntimeMessage(listener) {
        wasm.reactorclient_onRuntimeMessage(this.__wbg_ptr, listener);
    }
    /**
     * `(sessionId: string | undefined) => void`
     * @param {SessionIdListener} listener
     */
    onSessionIdChanged(listener) {
        wasm.reactorclient_onSessionIdChanged(this.__wbg_ptr, listener);
    }
    /**
     * `(status: string) => void`
     * @param {StatusListener} listener
     */
    onStatusChanged(listener) {
        wasm.reactorclient_onStatusChanged(this.__wbg_ptr, listener);
    }
    /**
     * `(name: string, mid: string | undefined) => void` — a remote track
     * arrived. Fetch the media with `getTrackByMid` / `getStreamByMid`.
     * @param {TrackListener} listener
     */
    onTrackReceived(listener) {
        wasm.reactorclient_onTrackReceived(this.__wbg_ptr, listener);
    }
    /**
     * Stop receiving a track: the receiver goes inactive and the runtime stops
     * producing it.
     * @param {string} name
     * @returns {Promise<void>}
     */
    pauseTrack(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_pauseTrack(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Names of the tracks currently paused.
     * @returns {string[]}
     */
    pausedTracks() {
        const ret = wasm.reactorclient_pausedTracks(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Claim a sendonly track and start sending `track` on it.
     * @param {string} name
     * @param {MediaStreamTrack} track
     * @returns {Promise<void>}
     */
    publishTrack(name, track) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_publishTrack(this.__wbg_ptr, ptr0, len0, track);
        return ret;
    }
    /**
     * Rebuild the transport on the same session, without ending it.
     *
     * Only `maxAttempts` applies here — the rest of `ConnectOptions` (session
     * adoption, connection id, auto-resume) only makes sense at initial
     * connect time, same as the JS SDK's own `reconnect()` always ignored
     * them.
     * @param {ConnectOptions | null} [options]
     * @returns {Promise<void>}
     */
    reconnect(options) {
        const ret = wasm.reactorclient_reconnect(this.__wbg_ptr, isLikeNone(options) ? 0 : addToExternrefTable0(options));
        return ret;
    }
    /**
     * Capture the last `durationSeconds` of the session.
     * @param {number} duration_seconds
     * @returns {Promise<Clip>}
     */
    requestClip(duration_seconds) {
        const ret = wasm.reactorclient_requestClip(this.__wbg_ptr, duration_seconds);
        return ret;
    }
    /**
     * Capture the session in full.
     * @returns {Promise<Clip>}
     */
    requestRecording() {
        const ret = wasm.reactorclient_requestRecording(this.__wbg_ptr);
        return ret;
    }
    /**
     * Request the model's command schema (an OpenAPI document).
     * @returns {Promise<unknown>}
     */
    requestSchema() {
        const ret = wasm.reactorclient_requestSchema(this.__wbg_ptr);
        return ret;
    }
    /**
     * Resume a paused track.
     * @param {string} name
     * @returns {Promise<void>}
     */
    resumeTrack(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_resumeTrack(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Send a command to the model and resolve with its reply.
     *
     * * `data` — a JSON-serializable object.
     * * `uploads` — optional `{ param: FileRef }` map, from `uploadFile`.
     *
     * Resolves with `{ type, data }`, or `undefined` when the model's handler
     * acknowledged the command without answering.
     * @param {string} command
     * @param {Record<string, unknown> | null} [data]
     * @param {Record<string, FileRef> | null} [uploads]
     * @returns {Promise<ReactorMessage | undefined>}
     */
    sendCommand(command, data, uploads) {
        const ptr0 = passStringToWasm0(command, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_sendCommand(this.__wbg_ptr, ptr0, len0, isLikeNone(data) ? 0 : addToExternrefTable0(data), isLikeNone(uploads) ? 0 : addToExternrefTable0(uploads));
        return ret;
    }
    /**
     * The current session id, or `undefined`.
     * @returns {string | undefined}
     */
    sessionId() {
        const ret = wasm.reactorclient_sessionId(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * The session resource from the coordinator, or `undefined` when
     * disconnected: model, cluster, server info, selected transport.
     * @returns {SessionInfo | undefined}
     */
    sessionInfo() {
        const ret = wasm.reactorclient_sessionInfo(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Replace the token source. Takes effect on the next request, so this is
     * how a client built before sign-in gets its token.
     * @param {JwtSource | null} [jwt]
     */
    setJwt(jwt) {
        const ret = wasm.reactorclient_setJwt(this.__wbg_ptr, isLikeNone(jwt) ? 0 : addToExternrefTable0(jwt));
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * `"disconnected"` | `"connecting"` | `"waiting"` | `"ready"`.
     * @returns {ReactorStatus}
     */
    status() {
        const ret = wasm.reactorclient_status(this.__wbg_ptr);
        return ret;
    }
    /**
     * The negotiated `name` → `mid` mapping: `[{ name, kind, direction, mid }]`.
     * @returns {TrackMappingEntry[]}
     */
    trackMapping() {
        const ret = wasm.reactorclient_trackMapping(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The tracks the runtime declared for this session:
     * `[{ name, kind, direction }]`. Empty until capabilities arrive.
     * @returns {TrackCapability[]}
     */
    tracks() {
        const ret = wasm.reactorclient_tracks(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Stop sending on a published track and release it.
     * @param {string} name
     * @returns {Promise<void>}
     */
    unpublishTrack(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_unpublishTrack(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Upload a `File` or `Blob` to the session's object store and resolve with
     * a `FileRef` to pass in a command's `uploads`.
     *
     * `name` overrides the file name; a `Blob` has none, so it needs one.
     * @param {Blob} file
     * @param {string | null} [name]
     * @returns {Promise<FileRef>}
     */
    uploadFile(file, name) {
        var ptr0 = isLikeNone(name) ? 0 : passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.reactorclient_uploadFile(this.__wbg_ptr, file, ptr0, len0);
        return ret;
    }
}
if (Symbol.dispose) ReactorClient.prototype[Symbol.dispose] = ReactorClient.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_92b29b0548f8b746: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_9a4e0ecb0fa16705: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_d968e41184ae354f: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_fa956cfa2d1bd751: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_c25d447a39f5578f: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_aca499c5de7ff5e5: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_2f76dc55065b4273: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_1ff95bcc5517c252: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_ea9085d691f535d3: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_a27215656b807791: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_ea5e6cc2e4141dfe: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_c05833b95a3cf397: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_e659fcf7b0e32763: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_db4c3b15f63fc170: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_394265ed1e1b84ee: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_b0ca35b86a603356: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_fffb441def202758: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_addTransceiver_ace2a0d9fb04ce1b: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.addTransceiver(getStringFromWasm0(arg1, arg2), arg3);
            return ret;
        },
        __wbg_apply_23dd4d2439189415: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.apply(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_arrayBuffer_3b637f0fa65c5351: function() { return handleError(function (arg0) {
            const ret = arg0.arrayBuffer();
            return ret;
        }, arguments); },
        __wbg_arrayBuffer_a158e423a87ee756: function(arg0) {
            const ret = arg0.arrayBuffer();
            return ret;
        },
        __wbg_assign_fd82cd5b89efb160: function(arg0, arg1) {
            const ret = Object.assign(arg0, arg1);
            return ret;
        },
        __wbg_call_8a2dd23819f8a60a: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_call_a6e5c5dce5018821: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_candidate_c03bb5d81bec0300: function(arg0) {
            const ret = arg0.candidate;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_candidate_f7f684cdcc2dfa01: function(arg0, arg1) {
            const ret = arg1.candidate;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_clone_6e4daf4fc3007688: function(arg0) {
            const ret = arg0.clone();
            return ret;
        },
        __wbg_close_b52db0582c2d1ef9: function(arg0) {
            arg0.close();
        },
        __wbg_close_c1dc24d72ecf36bf: function(arg0) {
            arg0.close();
        },
        __wbg_connectionState_8f907dbcbcdb52e9: function(arg0) {
            const ret = arg0.connectionState;
            return (__wbindgen_enum_RtcPeerConnectionState.indexOf(ret) + 1 || 7) - 1;
        },
        __wbg_createDataChannel_c6d560e9b1225d62: function(arg0, arg1, arg2) {
            const ret = arg0.createDataChannel(getStringFromWasm0(arg1, arg2));
            return ret;
        },
        __wbg_createOffer_bf4e8d6b4b5cea92: function(arg0) {
            const ret = arg0.createOffer();
            return ret;
        },
        __wbg_data_328de4280640da92: function(arg0) {
            const ret = arg0.data;
            return ret;
        },
        __wbg_debug_87fd9b1a625b7efb: function(arg0) {
            console.debug(arg0);
        },
        __wbg_done_89b2b13e91a60321: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_015dc610cd81ede0: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_error_744744ff0c9861e6: function(arg0) {
            console.error(arg0);
        },
        __wbg_fetch_6ecc661950e58d49: function(arg0, arg1) {
            const ret = arg0.fetch(arg1);
            return ret;
        },
        __wbg_fetch_b5951fc96f52f786: function(arg0, arg1) {
            const ret = arg0.fetch(arg1);
            return ret;
        },
        __wbg_get_507a50627bffa49b: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_78f252d074a84d0b: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_c7eb1f358a7654df: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_unchecked_6e0ad6d2a41b06f6: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_headers_cf9c80f30e2a4eff: function(arg0) {
            const ret = arg0.headers;
            return ret;
        },
        __wbg_info_eadbe775a8e2e9eb: function(arg0) {
            console.info(arg0);
        },
        __wbg_instanceof_ArrayBuffer_4480b9e0068a8adb: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Error_1fdac9f13a8181ba: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Error;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_File_ee62de53bca2e697: function(arg0) {
            let result;
            try {
                result = arg0 instanceof File;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Map_e5b5e3db98422fcc: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Map;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_MediaStream_acbfd121c4db2b74: function(arg0) {
            let result;
            try {
                result = arg0 instanceof MediaStream;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Object_33f20e6f12439f3e: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Object;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Promise_4cb210c0b8f8c959: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Promise;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Response_c8b64b2256f01bec: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Response;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_309b927aaf7a3fc7: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_05ba1ee4f6781663: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WorkerGlobalScope_8ec07b5e040a41c3: function(arg0) {
            let result;
            try {
                result = arg0 instanceof WorkerGlobalScope;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_0677c962b281d01a: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_04f36e4056f1b851: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_6f722e4a93058b71: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_1f0964f4a5e2c6d8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_370319915dc99107: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_log_d267660666346fb3: function(arg0) {
            console.log(arg0);
        },
        __wbg_message_8326fb1d549bebc5: function(arg0) {
            const ret = arg0.message;
            return ret;
        },
        __wbg_mid_6671271dd2f9460f: function(arg0, arg1) {
            const ret = arg1.mid;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_name_d7d79f5466e37447: function(arg0, arg1) {
            const ret = arg1.name;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_new_0d809930cd1354c6: function() { return handleError(function () {
            const ret = new Headers();
            return ret;
        }, arguments); },
        __wbg_new_32b398fb48b6d94a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_7796ffc7ed656783: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_aec3e25493d729fe: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen_85f920685b213f97___convert__closures_____invoke___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined_______true_(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_b667d279fd5aa943: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_cd45aabdf6073e84: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_da52cf8fe3429cb2: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_from_slice_77cdfb7977362f3c: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_1824d93f294193e5: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen_85f920685b213f97___convert__closures_____invoke___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined_______true_(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_configuration_40ac01bf87e5584e: function() { return handleError(function (arg0) {
            const ret = new RTCPeerConnection(arg0);
            return ret;
        }, arguments); },
        __wbg_new_with_str_and_init_d95cbe11ce28e65e: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
            return ret;
        }, arguments); },
        __wbg_new_with_tracks_6fa81eb205e387c7: function() { return handleError(function (arg0) {
            const ret = new MediaStream(arg0);
            return ret;
        }, arguments); },
        __wbg_next_6dbf2c0ac8cde20f: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_71f2aa1cb3d1e37e: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_now_86c0d4ba3fa605b8: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_prototypesetcall_4770620bbe4688a0: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_d2ae3af0c1217ae6: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_queueMicrotask_0ab5b2d2393e99b9: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_6a09b7bc46549209: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_replaceTrack_19163bddac4709c8: function(arg0, arg1) {
            const ret = arg0.replaceTrack(arg1);
            return ret;
        },
        __wbg_resolve_2191a4dfe481c25b: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_sdpMLineIndex_25f34f297ced702a: function(arg0) {
            const ret = arg0.sdpMLineIndex;
            return isLikeNone(ret) ? 0xFFFFFF : ret;
        },
        __wbg_sdpMid_d3e98f8b4c29e5d9: function(arg0, arg1) {
            const ret = arg1.sdpMid;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_send_5ebf3f8153c59081: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.send(getArrayU8FromWasm0(arg1, arg2));
        }, arguments); },
        __wbg_send_632c4452a512b363: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.send(getStringFromWasm0(arg1, arg2));
        }, arguments); },
        __wbg_sender_5d92a74ad2840ee0: function(arg0) {
            const ret = arg0.sender;
            return ret;
        },
        __wbg_setLocalDescription_423abfc919239ddf: function(arg0, arg1) {
            const ret = arg0.setLocalDescription(arg1);
            return ret;
        },
        __wbg_setRemoteDescription_921ff9a4233c90c7: function(arg0, arg1) {
            const ret = arg0.setRemoteDescription(arg1);
            return ret;
        },
        __wbg_setTimeout_6928223bf8fbd91a: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.setTimeout(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_setTimeout_cfa2cf195c3738db: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.setTimeout(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_0de9c62c23d04ad5: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.set(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
        }, arguments); },
        __wbg_set_575dd786d51585f8: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_8535240470bf2500: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_8a16b38e4805b298: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_binaryType_3d0ba17e56989d16: function(arg0, arg1) {
            arg0.binaryType = __wbindgen_enum_RtcDataChannelType[arg1];
        },
        __wbg_set_body_029f2d171e0a005f: function(arg0, arg1) {
            arg0.body = arg1;
        },
        __wbg_set_direction_1d775b49d9a3508b: function(arg0, arg1) {
            arg0.direction = __wbindgen_enum_RtcRtpTransceiverDirection[arg1];
        },
        __wbg_set_direction_baa4f2e93edf734f: function(arg0, arg1) {
            arg0.direction = __wbindgen_enum_RtcRtpTransceiverDirection[arg1];
        },
        __wbg_set_headers_9c61d123c3ee1f10: function(arg0, arg1) {
            arg0.headers = arg1;
        },
        __wbg_set_method_5532d59b92d76467: function(arg0, arg1, arg2) {
            arg0.method = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_name_3bbc583faefa4193: function(arg0, arg1, arg2) {
            arg0.name = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_onconnectionstatechange_993320a2febaef9b: function(arg0, arg1) {
            arg0.onconnectionstatechange = arg1;
        },
        __wbg_set_onicecandidate_0fd31ace2f760bf0: function(arg0, arg1) {
            arg0.onicecandidate = arg1;
        },
        __wbg_set_onmessage_5b4754d6f18ffa95: function(arg0, arg1) {
            arg0.onmessage = arg1;
        },
        __wbg_set_onopen_8994b7ffb0ef2792: function(arg0, arg1) {
            arg0.onopen = arg1;
        },
        __wbg_set_ontrack_32cae4df6350f244: function(arg0, arg1) {
            arg0.ontrack = arg1;
        },
        __wbg_set_sdp_de28f5c5c5b94fcb: function(arg0, arg1, arg2) {
            arg0.sdp = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_type_0a410d31ee19e04c: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_RtcSdpType[arg1];
        },
        __wbg_static_accessor_GLOBAL_4ef717fb391d88b7: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_8d1badc68b5a74f4: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_146583524fe1469b: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_f2829a2234d7819e: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_status_c45b3b9b3033184a: function(arg0) {
            const ret = arg0.status;
            return ret;
        },
        __wbg_streams_6e4af1bfd97a39c8: function(arg0) {
            const ret = arg0.streams;
            return ret;
        },
        __wbg_stringify_b54333f60f1e4dad: function() { return handleError(function (arg0) {
            const ret = JSON.stringify(arg0);
            return ret;
        }, arguments); },
        __wbg_then_16d107c451e9905d: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_6ec10ae38b3e92f7: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_track_2ee1f18714999962: function(arg0) {
            const ret = arg0.track;
            return ret;
        },
        __wbg_transceiver_04de1db3c684bea5: function(arg0) {
            const ret = arg0.transceiver;
            return ret;
        },
        __wbg_type_06f2150affb3c059: function(arg0, arg1) {
            const ret = arg1.type;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_value_a5d5488a9589444a: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbg_warn_b1370d804fa3e259: function(arg0) {
            console.warn(arg0);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 278, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_85f920685b213f97___convert__closures_____invoke___wasm_bindgen_85f920685b213f97___JsValue__core_9b3796e30d99ddb7___result__Result_____wasm_bindgen_85f920685b213f97___JsError___true_);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("MessageEvent")], shim_idx: 125, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true_);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("RTCPeerConnectionIceEvent")], shim_idx: 125, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__2);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("RTCTrackEvent")], shim_idx: 125, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__3);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [], shim_idx: 129, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_85f920685b213f97___convert__closures_____invoke_______true_);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000007: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000008: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000009: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./reactor_wasm_bg.js": import0,
    };
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke_______true_(arg0, arg1) {
    wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke_______true_(arg0, arg1);
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true_(arg0, arg1, arg2) {
    wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true_(arg0, arg1, arg2);
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__2(arg0, arg1, arg2) {
    wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__2(arg0, arg1, arg2);
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__3(arg0, arg1, arg2) {
    wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_43688100395f4fe3___features__gen_MessageEvent__MessageEvent______true__3(arg0, arg1, arg2);
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke___wasm_bindgen_85f920685b213f97___JsValue__core_9b3796e30d99ddb7___result__Result_____wasm_bindgen_85f920685b213f97___JsError___true_(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke___wasm_bindgen_85f920685b213f97___JsValue__core_9b3796e30d99ddb7___result__Result_____wasm_bindgen_85f920685b213f97___JsError___true_(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen_85f920685b213f97___convert__closures_____invoke___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined_______true_(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen_85f920685b213f97___convert__closures_____invoke___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined_______true_(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_RtcDataChannelType = ["arraybuffer", "blob"];


const __wbindgen_enum_RtcPeerConnectionState = ["closed", "failed", "disconnected", "new", "connecting", "connected"];


const __wbindgen_enum_RtcRtpTransceiverDirection = ["sendrecv", "sendonly", "recvonly", "inactive", "stopped"];


const __wbindgen_enum_RtcSdpType = ["offer", "pranswer", "answer", "rollback"];
const ReactorClientFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_reactorclient_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('reactor_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
