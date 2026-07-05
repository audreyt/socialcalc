
  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
    return uint8Array;
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 1048576, "wMAAFnNsaWNlIGluZGV4IHN0YXJ0cyBhdCDADSBidXQgZW5kcyBhdCDAACBpbmRleCBvdXQgb2YgYm91bmRzOiB0aGUgbGVuIGlzIMASIGJ1dCB0aGUgaW5kZXggaXMgwAAScmFuZ2Ugc3RhcnQgaW5kZXggwCIgb3V0IG9mIHJhbmdlIGZvciBzbGljZSBvZiBsZW5ndGggwAAQcmFuZ2UgZW5kIGluZGV4IMAiIG91dCBvZiByYW5nZSBmb3Igc2xpY2Ugb2YgbGVuZ3RoIMAAEGFzc2VydGlvbiBgbGVmdCDAFyByaWdodGAgZmFpbGVkCiAgbGVmdDogwAkKIHJpZ2h0OiDAABBhc3NlcnRpb24gYGxlZnQgwBAgcmlnaHRgIGZhaWxlZDogwAkKICBsZWZ0OiDACQogcmlnaHQ6IMAASGNhbm5vdCBhY2Nlc3MgYSBUaHJlYWQgTG9jYWwgU3RvcmFnZSB2YWx1ZSBkdXJpbmcgb3IgYWZ0ZXIgZGVzdHJ1Y3Rpb246IMAAwAI6IMAAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9ydXN0Yy80YTRlZjQ5M2UzYTE0ODhjNmUzMjE1NzAyMzgwODRiMzg5NDhmNmRiL2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9tdXRleC9ub190aHJlYWRzLnJzAC9ydXN0Yy80YTRlZjQ5M2UzYTE0ODhjNmUzMjE1NzAyMzgwODRiMzg5NDhmNmRiL2xpYnJhcnkvc3RkL3NyYy9zeXMvdGhyZWFkX2xvY2FsL25vX3RocmVhZHMucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tZW1jaHIucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9jb3JlL3NyYy9zdHIvcGF0dGVybi5ycwAvcnVzdGMvNGE0ZWY0OTNlM2ExNDg4YzZlMzIxNTcwMjM4MDg0YjM4OTQ4ZjZkYi9saWJyYXJ5L2NvcmUvc3JjL2ZtdC9udW0ucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwAvcnVzdGMvNGE0ZWY0OTNlM2ExNDg4YzZlMzIxNTcwMjM4MDg0YjM4OTQ4ZjZkYi9saWJyYXJ5L3N0ZC9zcmMvc3luYy9sYXp5X2xvY2sucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9zdGQvc3JjL3N5bmMvb25jZS5ycwAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE2LjEvc3JjL3Jhdy9tb2QucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy9tb2QucnMAL3J1c3QvZGVwcy9kbG1hbGxvYy0wLjIuMTEvc3JjL2RsbWFsbG9jLnJzAAEiwAEiAAApBBAATAAAANsAAAAUAAAAI1JFRiE8PT49PD4rLQAAAOsCEABPAAAAzQEAADcAAADrAhAATwAAAAkCAAA3AAAAaW52YWxpZCB1dGYtOCBtYXB1bmtub3duIHJld3JpdGUgbW9kZWludmFsaWQgdXRmLTggZm9ybXVsYQAAAgAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAQAAAAIAAAA7BRAAAAAAAAAAAAAAAAAAAAAAADkFEABABRAAPQUQAP//////////4AUQAAAAAAAAAAAAAAAAAGNhbm5vdCByZWN1cnNpdmVseSBhY3F1aXJlIG11dGV43gEQAFwAAAATAAAACQAAAEF0dGVtcHRlZCB0byBpbml0aWFsaXplIHRocmVhZC1sb2NhbCB3aGlsZSBpdCBpcyBiZWluZyBkcm9wcGVkAAA7AhAAXgAAAGsAAAANAAAAT25jZSBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBvaXNvbmVkb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHkAACkEEABMAAAA2wAAADEAAACHAxAATwAAAN8BAAAZAAAAbV3L1ixQ62N4QaZXcRuLuSPKO0qmd3yTQmNJr5dvsoRMYXp5TG9jayBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBvaXNvbmVkAADXAxAAUQAAAJoBAAAFAAAABwAAAAwAAAAEAAAACAAAAAkAAAAKAAAAAAAAAAgAAAAEAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAABAAAABAAAAARAAAAEgAAABMAAAAAAAAABAAAAAQAAAAUAAAAQWNjZXNzRXJyb3IAAAAAAAgAAAAEAAAAFQAAAGFzc2VydGlvbiBmYWlsZWQ6IHBzaXplID49IHNpemUgKyBtaW5fb3ZlcmhlYWQAAPIEEAAqAAAAsQQAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBwc2l6ZSA8PSBzaXplICsgbWF4X292ZXJoZWFkAADyBBAAKgAAALcEAAANAAAABwAAAAwAAAAEAAAAFgAAAEhhc2ggdGFibGUgY2FwYWNpdHkgb3ZlcmZsb3d2BBAAKgAAACUAAAAoAAAARXJyb3IAAAAXAAAADAAAAAQAAAAYAAAAGQAAABoAAAAAAAAAAAAAAAEAAAAbAAAAYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3QAAJUBEABIAAAAigIAAA4AAABjYXBhY2l0eSBvdmVyZmxvdwAAAKEEEABQAAAAHAAAAAUAAAACAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmFsc2V0cnVlMDAwMTAyMDMwNDA1MDYwNzA4MDkxMDExMTIxMzE0MTUxNjE3MTgxOTIwMjEyMjIzMjQyNTI2MjcyODI5MzAzMTMyMzMzNDM1MzYzNzM4Mzk0MDQxNDI0MzQ0NDU0NjQ3NDg0OTUwNTE1MjUzNTQ1NTU2NTc1ODU5NjA2MTYyNjM2NDY1NjY2NzY4Njk3MDcxNzI3Mzc0NzU3Njc3Nzg3OTgwODE4MjgzODQ4NTg2ODc4ODg5OTA5MTkyOTM5NDk1OTY5Nzk4OTkAAAA7AxAASwAAAFcCAAAFAAAAfSB9AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDBAQEBAQAAAAAAAAAAAAAAACaAhAAUAAAAKAAAAAJAAAAmgIQAFAAAACEAAAAHgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWU9PSE9bWF0Y2hlcwAAgwwQAIUMEACHDBAAAgAAAAIAAAAHAAAA");
  base64DecodeToExistingUint8Array(bufferView, 1051816, "BAAAAAAAAAAAAAAAAAAAAAAAAAA=");
}

  function wasm2js_memory_copy(dest, source, size) {
    // TODO: traps on invalid things
    bufferView.copyWithin(dest, source, source + size);
  }
      function wasm2js_trap() { throw new Error('abort'); }

  function wasm2js_memory_fill(dest, value, size) {
    dest = dest >>> 0;
    size = size >>> 0;
    if (dest + size > bufferView.length) throw "trap: invalid memory.fill";
    bufferView.fill(value, dest, dest + size);
  }
      
function asmFunc(imports) {
 var buffer = new ArrayBuffer(1114112);
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var __stack_pointer = 1048576;
 var global$1 = 1052352;
 var global$2 = 1052352;
 var i64toi32_i32$HIGH_BITS = 0;
 function _ZN16formula_ref_core11emit_string17h9b42b7a63c63262dE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0, $8 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, $5 = 0, $6 = 0, i64toi32_i32$4 = 0, $7 = 0, i64toi32_i32$3 = 0, $9 = 0, $20 = 0, $21 = 0, $22 = 0, $139 = 0, $140 = 0, $142$hi = 0, $145$hi = 0, $146 = 0;
  $3 = __stack_pointer - 64 | 0;
  __stack_pointer = $3;
  $4 = 0;
  block : {
   if (($2 | 0) < (0 | 0)) {
    break block
   }
   $5 = 1;
   block1 : {
    if (!$2) {
     break block1
    }
    _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
    $4 = 1;
    $5 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($2 | 0, 1 | 0) | 0;
    if (!$5) {
     break block
    }
   }
   $4 = 0;
   HEAP32[($3 + 12 | 0) >> 2] = 0;
   HEAP32[($3 + 8 | 0) >> 2] = $5;
   HEAP32[($3 + 4 | 0) >> 2] = $2;
   HEAP32[($3 + 36 | 0) >> 2] = 34;
   HEAP32[($3 + 32 | 0) >> 2] = $2;
   HEAP32[($3 + 28 | 0) >> 2] = 0;
   HEAP32[($3 + 24 | 0) >> 2] = $2;
   HEAP32[($3 + 20 | 0) >> 2] = $1;
   HEAP32[($3 + 16 | 0) >> 2] = 34;
   HEAP8[($3 + 40 | 0) >> 0] = 1;
   _ZN81_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__Searcher$GT$10next_match17h123487cfc1cd2b98E($3 + 48 | 0 | 0, $3 + 16 | 0 | 0);
   $6 = $2;
   $7 = 0;
   block2 : {
    if ((HEAP32[($3 + 48 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break block2
    }
    $4 = 0;
    $6 = 0;
    label : while (1) {
     $7 = HEAP32[($3 + 56 | 0) >> 2] | 0;
     block3 : {
      $8 = (HEAP32[($3 + 52 | 0) >> 2] | 0) - $6 | 0;
      $9 = HEAP32[($3 + 4 | 0) >> 2] | 0;
      if ($8 >>> 0 <= ($9 - $4 | 0) >>> 0) {
       break block3
      }
      _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 4 | 0 | 0, $4 | 0, $8 | 0, 1 | 0, 1 | 0);
      $9 = HEAP32[($3 + 4 | 0) >> 2] | 0;
      $5 = HEAP32[($3 + 8 | 0) >> 2] | 0;
      $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
     }
     block4 : {
      if (!$8) {
       break block4
      }
      wasm2js_memory_copy($5 + $4 | 0, $1 + $6 | 0, $8);
     }
     $4 = $4 + $8 | 0;
     HEAP32[($3 + 12 | 0) >> 2] = $4;
     block5 : {
      if (($9 - $4 | 0) >>> 0 > 1 >>> 0) {
       break block5
      }
      _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 4 | 0 | 0, $4 | 0, 2 | 0, 1 | 0, 1 | 0);
      $5 = HEAP32[($3 + 8 | 0) >> 2] | 0;
      $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
     }
     $20 = $5 + $4 | 0;
     $21 = 8738;
     HEAP8[$20 >> 0] = $21;
     HEAP8[($20 + 1 | 0) >> 0] = $21 >>> 8 | 0;
     $4 = $4 + 2 | 0;
     HEAP32[($3 + 12 | 0) >> 2] = $4;
     _ZN81_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__Searcher$GT$10next_match17h123487cfc1cd2b98E($3 + 48 | 0 | 0, $3 + 16 | 0 | 0);
     $6 = $7;
     if (HEAP32[($3 + 48 | 0) >> 2] | 0) {
      continue label
     }
     break label;
    };
    $6 = HEAP32[($3 + 4 | 0) >> 2] | 0;
   }
   block6 : {
    $8 = $2 - $7 | 0;
    if ($8 >>> 0 <= ($6 - $4 | 0) >>> 0) {
     break block6
    }
    _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 4 | 0 | 0, $4 | 0, $8 | 0, 1 | 0, 1 | 0);
    $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
   }
   block7 : {
    if (!$8) {
     break block7
    }
    wasm2js_memory_copy((HEAP32[($3 + 8 | 0) >> 2] | 0) + $4 | 0, $1 + $7 | 0, $8);
   }
   HEAP32[($3 + 24 | 0) >> 2] = $4 + $8 | 0;
   i64toi32_i32$2 = $3;
   i64toi32_i32$0 = HEAP32[($3 + 4 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[($3 + 8 | 0) >> 2] | 0;
   $139 = i64toi32_i32$0;
   i64toi32_i32$0 = $3;
   HEAP32[($3 + 16 | 0) >> 2] = $139;
   HEAP32[($3 + 20 | 0) >> 2] = i64toi32_i32$1;
   $140 = $3;
   i64toi32_i32$1 = 0;
   i64toi32_i32$2 = 1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $22 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $22 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $142$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   $145$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $142$hi;
   i64toi32_i32$1 = $22;
   i64toi32_i32$2 = $145$hi;
   i64toi32_i32$3 = $3 + 16 | 0;
   i64toi32_i32$2 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
   $146 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
   i64toi32_i32$1 = $140;
   HEAP32[(i64toi32_i32$1 + 48 | 0) >> 2] = $146;
   HEAP32[(i64toi32_i32$1 + 52 | 0) >> 2] = i64toi32_i32$2;
   _ZN5alloc3fmt6format12format_inner17h32c4432df66cb685E($0 | 0, 1049885 | 0, $3 + 48 | 0 | 0);
   block8 : {
    $4 = HEAP32[($3 + 16 | 0) >> 2] | 0;
    if (!$4) {
     break block8
    }
    _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($3 + 20 | 0) >> 2] | 0 | 0, $4 | 0, 1 | 0);
   }
   __stack_pointer = $3 + 64 | 0;
   return;
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($4 | 0, $2 | 0);
  wasm2js_trap();
 }
 
 function _ZN81_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__Searcher$GT$10next_match17h123487cfc1cd2b98E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $5 = 0, $14 = 0, $12 = 0, $13 = 0, $2 = 0, $4 = 0, $9 = 0, $10 = 0, $6 = 0, $7 = 0, $11 = 0, $3 = 0, $8 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  $3 = 0;
  block : {
   $4 = HEAP32[($1 + 16 | 0) >> 2] | 0;
   $5 = HEAP32[($1 + 12 | 0) >> 2] | 0;
   if ($4 >>> 0 < $5 >>> 0) {
    break block
   }
   $6 = HEAP32[($1 + 8 | 0) >> 2] | 0;
   if ($4 >>> 0 > $6 >>> 0) {
    break block
   }
   $7 = HEAP32[($1 + 4 | 0) >> 2] | 0;
   $8 = $1 + 20 | 0;
   $9 = HEAPU8[($1 + 24 | 0) >> 0] | 0;
   $10 = HEAPU8[(($8 + $9 | 0) + -1 | 0) >> 0] | 0;
   block6 : {
    block1 : {
     if ($9 >>> 0 < 5 >>> 0) {
      break block1
     }
     $11 = $10 & 255 | 0;
     label1 : while (1) {
      $12 = $7 + $5 | 0;
      block4 : {
       block2 : {
        $13 = $4 - $5 | 0;
        if ($13 >>> 0 > 7 >>> 0) {
         break block2
        }
        $14 = 0;
        block3 : {
         if ($13) {
          break block3
         }
         $12 = 0;
         break block4;
        }
        label : while (1) {
         block5 : {
          if ((HEAPU8[($12 + $14 | 0) >> 0] | 0 | 0) != ($11 | 0)) {
           break block5
          }
          $12 = 1;
          break block4;
         }
         $14 = $14 + 1 | 0;
         if (($13 | 0) != ($14 | 0)) {
          continue label
         }
         break label;
        };
        $12 = 0;
        $14 = $13;
        break block4;
       }
       _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($2 + 8 | 0 | 0, $10 | 0, $12 | 0, $13 | 0);
       $14 = HEAP32[($2 + 12 | 0) >> 2] | 0;
       $12 = HEAP32[($2 + 8 | 0) >> 2] | 0;
      }
      if (!($12 & 1 | 0)) {
       break block6
      }
      $5 = ($5 + $14 | 0) + 1 | 0;
      HEAP32[($1 + 12 | 0) >> 2] = $5;
      block8 : {
       block7 : {
        if ($5 >>> 0 < $9 >>> 0) {
         break block7
        }
        if ($5 >>> 0 <= $6 >>> 0) {
         break block8
        }
       }
       if ($4 >>> 0 >= $5 >>> 0) {
        continue label1
       }
       break block;
      }
      break label1;
     };
     _ZN4core5slice5index16slice_index_fail17hd5820a8e667bb547E(0 | 0, $9 | 0, 4 | 0, 1049924 | 0);
     wasm2js_trap();
    }
    $11 = $10 & 255 | 0;
    label3 : while (1) {
     $12 = $7 + $5 | 0;
     block10 : {
      block9 : {
       $13 = $4 - $5 | 0;
       if ($13 >>> 0 < 8 >>> 0) {
        break block9
       }
       _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($2 | 0, $10 | 0, $12 | 0, $13 | 0);
       $14 = HEAP32[($2 + 4 | 0) >> 2] | 0;
       $12 = HEAP32[$2 >> 2] | 0;
       break block10;
      }
      $14 = 0;
      block11 : {
       if ($13) {
        break block11
       }
       $12 = 0;
       break block10;
      }
      label2 : while (1) {
       block12 : {
        if ((HEAPU8[($12 + $14 | 0) >> 0] | 0 | 0) != ($11 | 0)) {
         break block12
        }
        $12 = 1;
        break block10;
       }
       $14 = $14 + 1 | 0;
       if (($13 | 0) != ($14 | 0)) {
        continue label2
       }
       break label2;
      };
      $12 = 0;
      $14 = $13;
     }
     if (!($12 & 1 | 0)) {
      break block6
     }
     $5 = ($5 + $14 | 0) + 1 | 0;
     HEAP32[($1 + 12 | 0) >> 2] = $5;
     block14 : {
      block13 : {
       if ($5 >>> 0 < $9 >>> 0) {
        break block13
       }
       if ($5 >>> 0 > $6 >>> 0) {
        break block13
       }
       $14 = $5 - $9 | 0;
       if (!(memcmp($7 + $14 | 0 | 0, $8 | 0, $9 | 0) | 0)) {
        break block14
       }
      }
      if ($4 >>> 0 >= $5 >>> 0) {
       continue label3
      }
      break block;
     }
     break label3;
    };
    HEAP32[($0 + 8 | 0) >> 2] = $5;
    HEAP32[($0 + 4 | 0) >> 2] = $14;
    $3 = 1;
    break block;
   }
   HEAP32[($1 + 12 | 0) >> 2] = $4;
  }
  HEAP32[$0 >> 2] = $3;
  __stack_pointer = $2 + 16 | 0;
 }
 
 function _ZN60_$LT$alloc__string__String$u20$as$u20$core__fmt__Display$GT$3fmt17h6a590826603d8397E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN42_$LT$str$u20$as$u20$core__fmt__Display$GT$3fmt17h2c2643320af0bbc5E(HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, HEAP32[($0 + 8 | 0) >> 2] | 0 | 0, $1 | 0) | 0 | 0;
 }
 
 function _ZN16formula_ref_core21adjust_formula_coords17h8ad8ddbe53204ac4E($0, $1, $2, $3, $4, $5, $6) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  $6 = $6 | 0;
  var $7 = 0, $21 = 0, $20 = 0, $19 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $24 = 0, $23 = 0, $26 = 0, $25 = 0, $11 = 0, $17 = 0, $22 = 0, $18 = 0, $34 = 0, $35 = 0, $8 = 0, $9 = 0, $10 = 0, $14 = 0, $27 = 0, $12 = 0, $13 = 0, $15 = 0, $16 = 0, $72 = 0, $270 = 0, $554 = 0, $628 = 0;
  $7 = __stack_pointer - 112 | 0;
  __stack_pointer = $7;
  _ZN16formula_ref_core25parse_formula_into_tokens17hcc096630f88aa449E($7 + 8 | 0 | 0, $1 | 0, $2 | 0);
  HEAP32[($7 + 28 | 0) >> 2] = 0;
  i64toi32_i32$1 = $7;
  i64toi32_i32$0 = 1;
  HEAP32[($7 + 20 | 0) >> 2] = 0;
  HEAP32[($7 + 24 | 0) >> 2] = i64toi32_i32$0;
  $8 = HEAP32[($7 + 12 | 0) >> 2] | 0;
  $2 = HEAP32[($7 + 16 | 0) >> 2] | 0;
  $9 = $8 + ($2 << 4 | 0) | 0;
  $10 = HEAP32[($7 + 8 | 0) >> 2] | 0;
  $11 = $8;
  block59 : {
   block : {
    if (!$2) {
     break block
    }
    $12 = $5 - $6 | 0;
    $13 = $3 - $4 | 0;
    $14 = ($7 + 32 | 0) + 4 | 0;
    $15 = $14 + 8 | 0;
    $16 = ($4 | 0) > (-1 | 0);
    $1 = 0;
    $2 = $11;
    $17 = 0;
    label2 : while (1) {
     $11 = $2 + 16 | 0;
     $18 = HEAP32[$2 >> 2] | 0;
     if (($18 | 0) == (-2147483648 | 0)) {
      break block
     }
     i64toi32_i32$0 = HEAP32[($2 + 4 | 0) >> 2] | 0;
     i64toi32_i32$1 = HEAP32[($2 + 8 | 0) >> 2] | 0;
     $72 = i64toi32_i32$0;
     i64toi32_i32$0 = $14;
     HEAP32[i64toi32_i32$0 >> 2] = $72;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     HEAP32[$15 >> 2] = HEAP32[($2 + 12 | 0) >> 2] | 0;
     HEAP32[($7 + 32 | 0) >> 2] = $18;
     _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($7 + 48 | 0 | 0, $7 + 32 | 0 | 0);
     block1 : {
      $2 = HEAPU8[($7 + 44 | 0) >> 0] | 0;
      if (($2 | 0) != (3 | 0)) {
       break block1
      }
      $19 = HEAP32[($7 + 52 | 0) >> 2] | 0;
      block12 : {
       block11 : {
        block10 : {
         block4 : {
          block9 : {
           block5 : {
            block2 : {
             $2 = HEAP32[($7 + 56 | 0) >> 2] | 0;
             if (($2 | 0) != (1 | 0)) {
              break block2
             }
             $2 = 1;
             block3 : {
              $20 = HEAPU8[$19 >> 0] | 0;
              if (($20 | 0) != (33 | 0)) {
               break block3
              }
              $17 = 1;
              $21 = $19;
              break block4;
             }
             $17 = ($20 | 0) == (58 | 0) & $17 | 0;
             $21 = 1049915;
             $2 = 2;
             block8 : {
              switch ($20 + -71 | 0 | 0) {
              case 5:
               $21 = 1049913;
               break block4;
              case 6:
               $21 = 1049920;
               break block9;
              case 0:
               break block4;
              case 7:
               break block8;
              default:
               break block5;
              };
             }
             $21 = 1049917;
             break block4;
            }
            $20 = 0;
            if (($2 | 0) < (0 | 0)) {
             break block10
            }
            $17 = 0;
            if (!$2) {
             break block11
            }
            $21 = $19;
            break block4;
           }
           $21 = ($20 | 0) == (80 | 0) ? 1049919 : $19;
          }
          $2 = 1;
         }
         _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
         $20 = 1;
         $22 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($2 | 0, 1 | 0) | 0;
         if ($22) {
          break block12
         }
         $22 = $2;
        }
        _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($20 | 0, $22 | 0);
        wasm2js_trap();
       }
       $22 = 1;
       $2 = 0;
       $21 = $19;
      }
      block13 : {
       if (!$2) {
        break block13
       }
       wasm2js_memory_copy($22, $21, $2);
      }
      block14 : {
       $20 = HEAP32[($7 + 48 | 0) >> 2] | 0;
       if (!$20) {
        break block14
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($19 | 0, $20 | 0, 1 | 0);
      }
      HEAP32[($7 + 56 | 0) >> 2] = $2;
      HEAP32[($7 + 52 | 0) >> 2] = $22;
      HEAP32[($7 + 48 | 0) >> 2] = $2;
      $2 = HEAPU8[($7 + 44 | 0) >> 0] | 0;
     }
     block16 : {
      block29 : {
       block28 : {
        block17 : {
         switch (($2 & 255 | 0) + -2 | 0 | 0) {
         case 0:
          $23 = HEAP32[($7 + 52 | 0) >> 2] | 0;
          $24 = HEAP32[($7 + 56 | 0) >> 2] | 0;
          $19 = $23 + $24 | 0;
          $25 = 0;
          $2 = $23;
          $20 = 0;
          label : while (1) {
           block23 : {
            block18 : {
             if (($2 | 0) == ($19 | 0)) {
              break block18
             }
             block20 : {
              block19 : {
               $1 = HEAP8[$2 >> 0] | 0;
               if (($1 | 0) <= (-1 | 0)) {
                break block19
               }
               $2 = $2 + 1 | 0;
               $1 = $1 & 255 | 0;
               break block20;
              }
              $21 = (HEAPU8[($2 + 1 | 0) >> 0] | 0) & 63 | 0;
              $26 = $1 & 31 | 0;
              block21 : {
               if ($1 >>> 0 > -33 >>> 0) {
                break block21
               }
               $1 = $26 << 6 | 0 | $21 | 0;
               $2 = $2 + 2 | 0;
               break block20;
              }
              $21 = $21 << 6 | 0 | ((HEAPU8[($2 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
              block22 : {
               if ($1 >>> 0 >= -16 >>> 0) {
                break block22
               }
               $1 = $21 | ($26 << 12 | 0) | 0;
               $2 = $2 + 3 | 0;
               break block20;
              }
              $1 = $21 << 6 | 0 | ((HEAPU8[($2 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($26 << 18 | 0) & 1835008 | 0) | 0;
              $2 = $2 + 4 | 0;
             }
             if (($1 | 0) == (36 | 0)) {
              continue label
             }
             $21 = $1 + -48 | 0;
             if ($21 >>> 0 < 10 >>> 0) {
              break block23
             }
             $21 = $1 + -97 | 0;
             block24 : {
              if (($1 + -65 | 0) >>> 0 < 26 >>> 0) {
               break block24
              }
              if ($21 >>> 0 >= 26 >>> 0) {
               continue label
              }
             }
             $20 = (($21 >>> 0 < 26 >>> 0 ? 31 : 63) & $1 | 0) + Math_imul($20, 26) | 0;
             continue label;
            }
            block27 : {
             block26 : {
              block25 : {
               if ($16) {
                break block25
               }
               if (($20 | 0) < ($3 | 0)) {
                break block25
               }
               if (($20 | 0) < ($13 | 0)) {
                break block26
               }
              }
              if (!((($6 | 0) > (-1 | 0) | (($25 | 0) < ($5 | 0) | ($25 | 0) >= ($12 | 0) | 0) | 0 | $17 | 0) & 1 | 0)) {
               break block27
              }
              break block28;
             }
             if ($17 & 1 | 0) {
              break block29
             }
            }
            $25 = 0;
            $20 = 0;
            break block28;
           }
           $25 = $21 + Math_imul($25, 10) | 0;
           continue label;
          };
         case 4:
          break block17;
         default:
          break block16;
         };
        }
        _ZN16formula_ref_core11emit_string17h9b42b7a63c63262dE($7 + 84 | 0 | 0, HEAP32[($7 + 36 | 0) >> 2] | 0 | 0, HEAP32[($7 + 40 | 0) >> 2] | 0 | 0);
        block30 : {
         $2 = HEAP32[($7 + 48 | 0) >> 2] | 0;
         if (!$2) {
          break block30
         }
         _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($7 + 52 | 0) >> 2] | 0 | 0, $2 | 0, 1 | 0);
        }
        HEAP32[(($7 + 48 | 0) + 8 | 0) >> 2] = HEAP32[(($7 + 84 | 0) + 8 | 0) >> 2] | 0;
        i64toi32_i32$1 = HEAP32[($7 + 84 | 0) >> 2] | 0;
        i64toi32_i32$0 = HEAP32[($7 + 88 | 0) >> 2] | 0;
        $270 = i64toi32_i32$1;
        i64toi32_i32$1 = $7;
        HEAP32[($7 + 48 | 0) >> 2] = $270;
        HEAP32[($7 + 52 | 0) >> 2] = i64toi32_i32$0;
        break block16;
       }
       if ($17 & 1 | 0) {
        break block29
       }
       $25 = (($25 | 0) < ($5 | 0) ? 0 : $6) + $25 | 0;
       $20 = (($20 | 0) < ($3 | 0) ? 0 : $4) + $20 | 0;
      }
      block38 : {
       block32 : {
        block31 : {
         if ($24) {
          break block31
         }
         i64toi32_i32$1 = $7;
         i64toi32_i32$0 = 1;
         HEAP32[($7 + 60 | 0) >> 2] = 0;
         HEAP32[($7 + 64 | 0) >> 2] = i64toi32_i32$0;
         $1 = 0;
         $2 = 0;
         break block32;
        }
        $19 = HEAPU8[$23 >> 0] | 0;
        block37 : {
         block35 : {
          block34 : {
           block33 : {
            if ($24 >>> 0 > 7 >>> 0) {
             break block33
            }
            if ((HEAPU8[$23 >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (1 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 1 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (2 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 2 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (3 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 3 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (4 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 4 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (5 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 5 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            if (($24 | 0) == (6 | 0)) {
             break block35
            }
            if ((HEAPU8[($23 + 6 | 0) >> 0] | 0 | 0) == (36 | 0)) {
             break block34
            }
            break block35;
           }
           _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($7 | 0, 36 | 0, $23 | 0, $24 | 0);
           if ((HEAP32[$7 >> 2] | 0 | 0) != (1 | 0)) {
            break block35
           }
          }
          HEAP32[($7 + 100 | 0) >> 2] = $24;
          HEAP32[($7 + 96 | 0) >> 2] = 0;
          HEAP32[($7 + 92 | 0) >> 2] = $24;
          HEAP32[($7 + 88 | 0) >> 2] = $23;
          HEAP8[($7 + 108 | 0) >> 0] = 1;
          HEAP32[($7 + 84 | 0) >> 2] = 36;
          HEAP32[($7 + 104 | 0) >> 2] = 36;
          _ZN88_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__ReverseSearcher$GT$15next_match_back17h2fa1a9c58682dc7fE($7 + 72 | 0 | 0, $7 + 84 | 0 | 0);
          block36 : {
           if (!(HEAP32[($7 + 72 | 0) >> 2] | 0)) {
            break block36
           }
           $1 = 0;
           HEAP32[($7 + 68 | 0) >> 2] = 0;
           i64toi32_i32$1 = $7;
           i64toi32_i32$0 = 1;
           HEAP32[($7 + 60 | 0) >> 2] = 0;
           HEAP32[($7 + 64 | 0) >> 2] = i64toi32_i32$0;
           $24 = (HEAP32[($7 + 76 | 0) >> 2] | 0 | 0) != (0 | 0);
           $2 = $24;
           if (($19 & 255 | 0 | 0) == (36 | 0)) {
            break block37
           }
           break block38;
          }
          $1 = 0;
          HEAP32[($7 + 68 | 0) >> 2] = 0;
          i64toi32_i32$1 = $7;
          i64toi32_i32$0 = 1;
          HEAP32[($7 + 60 | 0) >> 2] = 0;
          HEAP32[($7 + 64 | 0) >> 2] = i64toi32_i32$0;
          $24 = 0;
          $2 = 0;
          if (($19 & 255 | 0 | 0) != (36 | 0)) {
           break block38
          }
          break block37;
         }
         $1 = 0;
         HEAP32[($7 + 68 | 0) >> 2] = 0;
         i64toi32_i32$1 = $7;
         i64toi32_i32$0 = 1;
         HEAP32[($7 + 60 | 0) >> 2] = 0;
         HEAP32[($7 + 64 | 0) >> 2] = i64toi32_i32$0;
         $24 = 0;
         $2 = 0;
         if (($19 & 255 | 0 | 0) != (36 | 0)) {
          break block38
         }
        }
        $1 = 1;
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 60 | 0 | 0, 0 | 0, 1 | 0, 1 | 0, 1 | 0);
        HEAP8[((HEAP32[($7 + 64 | 0) >> 2] | 0) + (HEAP32[($7 + 68 | 0) >> 2] | 0) | 0) >> 0] = 36;
       }
       HEAP32[($7 + 68 | 0) >> 2] = $1;
       $24 = $2;
      }
      HEAP32[($7 + 92 | 0) >> 2] = 0;
      i64toi32_i32$1 = $7;
      i64toi32_i32$0 = 1;
      HEAP32[($7 + 84 | 0) >> 2] = 0;
      HEAP32[($7 + 88 | 0) >> 2] = i64toi32_i32$0;
      block42 : {
       block39 : {
        $27 = ($20 | 0) < (1 | 0);
        if ($27) {
         break block39
        }
        $21 = 1;
        $1 = -1;
        label1 : while (1) {
         $19 = $20 + -1 | 0;
         $20 = ($19 >>> 0) / (26 >>> 0) | 0;
         $26 = Math_imul($20, 26);
         block40 : {
          $2 = $1 + 1 | 0;
          if (($2 | 0) != (HEAP32[($7 + 84 | 0) >> 2] | 0 | 0)) {
           break block40
          }
          _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 84 | 0 | 0, $2 | 0, 1 | 0, 1 | 0, 1 | 0);
          $21 = HEAP32[($7 + 88 | 0) >> 2] | 0;
         }
         $26 = $19 - $26 | 0;
         block41 : {
          if (!$2) {
           break block41
          }
          wasm2js_memory_copy($21 + 1 | 0, $21, $2);
         }
         HEAP8[$21 >> 0] = $26 + 65 | 0;
         HEAP32[($7 + 92 | 0) >> 2] = $1 + 2 | 0;
         $1 = $2;
         if ($19 >>> 0 > 25 >>> 0) {
          continue label1
         }
         break label1;
        };
        $19 = $2 + 1 | 0;
        $26 = HEAP32[($7 + 88 | 0) >> 2] | 0;
        $21 = HEAP32[($7 + 84 | 0) >> 2] | 0;
        $1 = HEAP32[($7 + 68 | 0) >> 2] | 0;
        if ($2 >>> 0 < ((HEAP32[($7 + 60 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
         break block42
        }
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 60 | 0 | 0, $1 | 0, $19 | 0, 1 | 0, 1 | 0);
        $1 = HEAP32[($7 + 68 | 0) >> 2] | 0;
        break block42;
       }
       $26 = 1;
       $21 = 0;
       $19 = 0;
      }
      $20 = HEAP32[($7 + 64 | 0) >> 2] | 0;
      block43 : {
       if (!$19) {
        break block43
       }
       wasm2js_memory_copy($20 + $1 | 0, $26, $19);
      }
      $2 = $1 + $19 | 0;
      HEAP32[($7 + 68 | 0) >> 2] = $2;
      block44 : {
       if (!$21) {
        break block44
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($26 | 0, $21 | 0, 1 | 0);
      }
      $19 = HEAP32[($7 + 60 | 0) >> 2] | 0;
      block45 : {
       if (!$24) {
        break block45
       }
       $1 = $2;
       block46 : {
        if (($19 | 0) != ($2 | 0)) {
         break block46
        }
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 60 | 0 | 0, $2 | 0, 1 | 0, 1 | 0, 1 | 0);
        $19 = HEAP32[($7 + 60 | 0) >> 2] | 0;
        $1 = HEAP32[($7 + 68 | 0) >> 2] | 0;
        $20 = HEAP32[($7 + 64 | 0) >> 2] | 0;
       }
       HEAP8[($20 + $1 | 0) >> 0] = 36;
       $2 = $2 + 1 | 0;
       HEAP32[($7 + 68 | 0) >> 2] = $2;
      }
      _ZN51_$LT$i32$u20$as$u20$alloc__string__SpecToString$GT$14spec_to_string17h87b9cefa6d9a8d7dE($7 + 84 | 0 | 0, $25 | 0);
      $21 = HEAP32[($7 + 88 | 0) >> 2] | 0;
      block47 : {
       $1 = HEAP32[($7 + 92 | 0) >> 2] | 0;
       if ($1 >>> 0 <= ($19 - $2 | 0) >>> 0) {
        break block47
       }
       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 60 | 0 | 0, $2 | 0, $1 | 0, 1 | 0, 1 | 0);
       $20 = HEAP32[($7 + 64 | 0) >> 2] | 0;
       $2 = HEAP32[($7 + 68 | 0) >> 2] | 0;
      }
      block48 : {
       if (!$1) {
        break block48
       }
       wasm2js_memory_copy($20 + $2 | 0, $21, $1);
      }
      HEAP32[($7 + 68 | 0) >> 2] = $2 + $1 | 0;
      block49 : {
       $2 = HEAP32[($7 + 84 | 0) >> 2] | 0;
       if (!$2) {
        break block49
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($21 | 0, $2 | 0, 1 | 0);
      }
      block51 : {
       block50 : {
        if (($25 | 0) < (1 | 0)) {
         break block50
        }
        if (!$27) {
         break block51
        }
       }
       _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
       block52 : {
        $2 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(5 | 0, 1 | 0) | 0;
        if (!$2) {
         break block52
        }
        HEAP8[($2 + 4 | 0) >> 0] = HEAPU8[(0 + 1049912 | 0) >> 0] | 0;
        $34 = 0;
        $35 = HEAPU8[($34 + 1049908 | 0) >> 0] | 0 | ((HEAPU8[($34 + 1049909 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($34 + 1049910 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($34 + 1049911 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        HEAP8[$2 >> 0] = $35;
        HEAP8[($2 + 1 | 0) >> 0] = $35 >>> 8 | 0;
        HEAP8[($2 + 2 | 0) >> 0] = $35 >>> 16 | 0;
        HEAP8[($2 + 3 | 0) >> 0] = $35 >>> 24 | 0;
        block53 : {
         $1 = HEAP32[($7 + 60 | 0) >> 2] | 0;
         if (!$1) {
          break block53
         }
         _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($20 | 0, $1 | 0, 1 | 0);
        }
        HEAP32[($7 + 68 | 0) >> 2] = 5;
        HEAP32[($7 + 64 | 0) >> 2] = $2;
        HEAP32[($7 + 60 | 0) >> 2] = 5;
        break block51;
       }
       _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 5 | 0);
       wasm2js_trap();
      }
      block54 : {
       $2 = HEAP32[($7 + 48 | 0) >> 2] | 0;
       if (!$2) {
        break block54
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($23 | 0, $2 | 0, 1 | 0);
      }
      HEAP32[(($7 + 48 | 0) + 8 | 0) >> 2] = HEAP32[(($7 + 60 | 0) + 8 | 0) >> 2] | 0;
      i64toi32_i32$0 = HEAP32[($7 + 60 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[($7 + 64 | 0) >> 2] | 0;
      $554 = i64toi32_i32$0;
      i64toi32_i32$0 = $7;
      HEAP32[($7 + 48 | 0) >> 2] = $554;
      HEAP32[($7 + 52 | 0) >> 2] = i64toi32_i32$1;
      $1 = HEAP32[($7 + 28 | 0) >> 2] | 0;
     }
     $19 = HEAP32[($7 + 52 | 0) >> 2] | 0;
     block55 : {
      $2 = HEAP32[($7 + 56 | 0) >> 2] | 0;
      if ($2 >>> 0 <= ((HEAP32[($7 + 20 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
       break block55
      }
      _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($7 + 20 | 0 | 0, $1 | 0, $2 | 0, 1 | 0, 1 | 0);
      $1 = HEAP32[($7 + 28 | 0) >> 2] | 0;
     }
     block56 : {
      if (!$2) {
       break block56
      }
      wasm2js_memory_copy((HEAP32[($7 + 24 | 0) >> 2] | 0) + $1 | 0, $19, $2);
     }
     $1 = $1 + $2 | 0;
     HEAP32[($7 + 28 | 0) >> 2] = $1;
     block57 : {
      $2 = HEAP32[($7 + 48 | 0) >> 2] | 0;
      if (!$2) {
       break block57
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($19 | 0, $2 | 0, 1 | 0);
     }
     block58 : {
      if (!$18) {
       break block58
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($7 + 36 | 0) >> 2] | 0 | 0, $18 | 0, 1 | 0);
     }
     $2 = $11;
     if (($2 | 0) != ($9 | 0)) {
      continue label2
     }
     break block59;
    };
   }
   if (($9 | 0) == ($11 | 0)) {
    break block59
   }
   $2 = ($9 - $11 | 0) >>> 4 | 0;
   label3 : while (1) {
    block60 : {
     $1 = HEAP32[$11 >> 2] | 0;
     if (!$1) {
      break block60
     }
     _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($11 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
    }
    $11 = $11 + 16 | 0;
    $2 = $2 + -1 | 0;
    if ($2) {
     continue label3
    }
    break label3;
   };
  }
  block61 : {
   if (!$10) {
    break block61
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($8 | 0, $10 << 4 | 0 | 0, 4 | 0);
  }
  i64toi32_i32$1 = HEAP32[($7 + 20 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[($7 + 24 | 0) >> 2] | 0;
  $628 = i64toi32_i32$1;
  i64toi32_i32$1 = $0;
  HEAP32[i64toi32_i32$1 >> 2] = $628;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = HEAP32[(($7 + 20 | 0) + 8 | 0) >> 2] | 0;
  __stack_pointer = $7 + 112 | 0;
 }
 
 function _ZN16formula_ref_core25parse_formula_into_tokens17hcc096630f88aa449E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $15 = 0, $7 = 0, $3 = 0, $11 = 0, $9 = 0, $6 = 0, $10 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $12 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $17 = 0, $16 = 0, $18 = 0, $13 = 0, $14 = 0, $8 = 0, $45 = 0, $4$hi = 0, $46 = 0, $47 = 0, $48 = 0, $4 = 0, $34$hi = 0, $37$hi = 0, $5 = 0, $5$hi = 0, $194 = 0, $214 = 0, $305 = 0, $325 = 0, $361 = 0, $381 = 0, $517 = 0, $628 = 0, $778 = 0, $1217 = 0, $1248 = 0, $1336$hi = 0, $1337 = 0, $1448 = 0, $2140 = 0, $2160 = 0, $2298 = 0;
  $3 = __stack_pointer - 96 | 0;
  __stack_pointer = $3;
  _ZN111_$LT$alloc__vec__Vec$LT$T$GT$$u20$as$u20$alloc__vec__spec_from_iter_nested__SpecFromIterNested$LT$T$C$I$GT$$GT$9from_iter17h943992d3e14995e3E($3 | 0, $1 | 0, $1 + $2 | 0 | 0);
  HEAP32[($3 + 20 | 0) >> 2] = 0;
  i64toi32_i32$1 = $3;
  i64toi32_i32$0 = 4;
  HEAP32[($3 + 12 | 0) >> 2] = 0;
  HEAP32[($3 + 16 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[($3 + 32 | 0) >> 2] = 0;
  i64toi32_i32$1 = $3;
  i64toi32_i32$0 = 1;
  HEAP32[($3 + 24 | 0) >> 2] = 0;
  HEAP32[($3 + 28 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = 1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $45 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $45 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $4 = $45;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$0 = 2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   $46 = 0;
  } else {
   i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $46 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
  }
  $34$hi = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  $37$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $34$hi;
  i64toi32_i32$1 = $46;
  i64toi32_i32$0 = $37$hi;
  i64toi32_i32$3 = $3 + 36 | 0;
  i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
  $5 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
  $5$hi = i64toi32_i32$0;
  $6 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  $2 = 0;
  $7 = 0;
  $8 = 0;
  label5 : while (1) {
   $9 = 0;
   $10 = 0;
   $11 = 0;
   $12 = 0;
   $13 = 0;
   $14 = 1;
   $15 = 4;
   $1 = 0;
   block : {
    if ($2 >>> 0 >= $6 >>> 0) {
     break block
    }
    block1 : {
     $1 = HEAP32[((HEAP32[($3 + 4 | 0) >> 2] | 0) + ($2 << 2 | 0) | 0) >> 2] | 0;
     if (($1 + -48 | 0) >>> 0 >= 10 >>> 0) {
      break block1
     }
     $11 = 1;
     $9 = 0;
     $10 = 0;
     $12 = 0;
     $13 = 0;
     $14 = 1;
     $15 = 1;
     break block;
    }
    $15 = 2;
    $11 = 0;
    $9 = 0;
    $10 = 0;
    $12 = 0;
    $13 = 0;
    $14 = $8;
    block9 : {
     block11 : {
      block10 : {
       block8 : {
        block6 : {
         switch ($1 + -9 | 0 | 0) {
         default:
          if ((($1 & 2097119 | 0) + -65 | 0) >>> 0 < 26 >>> 0) {
           break block8
          }
          $15 = 7;
          break block9;
         case 24:
         case 28:
         case 29:
         case 31:
         case 32:
         case 33:
         case 34:
         case 35:
         case 36:
         case 38:
         case 49:
         case 51:
         case 52:
         case 53:
         case 85:
          $15 = 3;
          break block9;
         case 27:
          $15 = 6;
          $13 = 1;
          $9 = 0;
          $10 = 0;
          $12 = 0;
          $14 = 1;
          break block;
         case 25:
         case 30:
          $15 = 8;
          $9 = 1;
          $10 = 0;
          break block10;
         case 0:
         case 1:
         case 4:
         case 23:
          $15 = 9;
          $10 = 1;
          $9 = 0;
          break block10;
         case 37:
          break block;
         case 26:
          break block6;
         case 86:
          break block8;
         };
        }
        $15 = 10;
        break block9;
       }
       $15 = 5;
       $12 = 1;
       $9 = 0;
       $10 = 0;
       break block11;
      }
      $12 = 0;
     }
     $13 = 0;
     $14 = 1;
     break block;
    }
    $14 = 1;
    $9 = 0;
    $10 = 0;
    $12 = 0;
    $13 = 0;
   }
   HEAP32[($3 + 36 | 0) >> 2] = $1;
   block23 : {
    block153 : {
     block34 : {
      block36 : {
       block181 : {
        block233 : {
         block245 : {
          block243 : {
           block231 : {
            block38 : {
             block238 : {
              block247 : {
               block236 : {
                block237 : {
                 block24 : {
                  block46 : {
                   block50 : {
                    block68 : {
                     block70 : {
                      block73 : {
                       block75 : {
                        block183 : {
                         block85 : {
                          block182 : {
                           block96 : {
                            block102 : {
                             block118 : {
                              block126 : {
                               block135 : {
                                block164 : {
                                 block147 : {
                                  block177 : {
                                   block138 : {
                                    block151 : {
                                     block158 : {
                                      block161 : {
                                       block156 : {
                                        block149 : {
                                         block145 : {
                                          block133 : {
                                           block124 : {
                                            block116 : {
                                             block100 : {
                                              block94 : {
                                               block56 : {
                                                block32 : {
                                                 block17 : {
                                                  block109 : {
                                                   block111 : {
                                                    block110 : {
                                                     block107 : {
                                                      block106 : {
                                                       block105 : {
                                                        block21 : {
                                                         block12 : {
                                                          block13 : {
                                                           block22 : {
                                                            block19 : {
                                                             block25 : {
                                                              block14 : {
                                                               switch ($7 & 255 | 0 | 0) {
                                                               case 6:
                                                                if (!$11) {
                                                                 break block22
                                                                }
                                                                $7 = 7;
                                                                break block23;
                                                               case 3:
                                                                $7 = 8;
                                                                switch ($15 + -1 | 0 | 0) {
                                                                case 4:
                                                                 break block23;
                                                                case 0:
                                                                case 5:
                                                                 break block24;
                                                                default:
                                                                 break block25;
                                                                };
                                                               case 4:
                                                                $7 = 0;
                                                                block26 : {
                                                                 switch ($15 + -4 | 0 | 0) {
                                                                 case 4:
                                                                  $2 = $2 + 1 | 0;
                                                                  $7 = 5;
                                                                  break block23;
                                                                 case 0:
                                                                  break block23;
                                                                 default:
                                                                  break block26;
                                                                 };
                                                                }
                                                                block29 : {
                                                                 block28 : {
                                                                  $11 = $1 >>> 0 < 128 >>> 0;
                                                                  if (!$11) {
                                                                   break block28
                                                                  }
                                                                  $15 = 1;
                                                                  break block29;
                                                                 }
                                                                 block30 : {
                                                                  if ($1 >>> 0 >= 2048 >>> 0) {
                                                                   break block30
                                                                  }
                                                                  $15 = 2;
                                                                  break block29;
                                                                 }
                                                                 $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                                }
                                                                $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                                $7 = $6;
                                                                block31 : {
                                                                 if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                                  break block31
                                                                 }
                                                                 _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                                 $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                                }
                                                                $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                                if ($11) {
                                                                 break block32
                                                                }
                                                                $9 = $1 & 63 | 0 | -128 | 0;
                                                                $11 = $1 >>> 6 | 0;
                                                                block33 : {
                                                                 if ($1 >>> 0 >= 2048 >>> 0) {
                                                                  break block33
                                                                 }
                                                                 HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                                 HEAP8[$7 >> 0] = $11 | 192 | 0;
                                                                 break block34;
                                                                }
                                                                $10 = $1 >>> 12 | 0;
                                                                $11 = $11 & 63 | 0 | -128 | 0;
                                                                block35 : {
                                                                 if ($1 >>> 0 > 65535 >>> 0) {
                                                                  break block35
                                                                 }
                                                                 HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                                 HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                                 HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                                 break block34;
                                                                }
                                                                HEAP8[($7 + 3 | 0) >> 0] = $9;
                                                                HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                                HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                                HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                                break block34;
                                                               case 8:
                                                                if (($15 & 11 | 0 | 0) == (1 | 0)) {
                                                                 break block36
                                                                }
                                                                block37 : {
                                                                 if ($2 >>> 0 >= $6 >>> 0) {
                                                                  break block37
                                                                 }
                                                                 if (!($10 | ($15 & 14 | 0 | 0) == (2 | 0) | 0)) {
                                                                  break block38
                                                                 }
                                                                }
                                                                $1 = 0;
                                                                block41 : {
                                                                 block42 : {
                                                                  block39 : {
                                                                   $11 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                                   if (($11 | 0) < (0 | 0)) {
                                                                    break block39
                                                                   }
                                                                   $15 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                                   block40 : {
                                                                    if ($11) {
                                                                     break block40
                                                                    }
                                                                    $16 = 1;
                                                                    if (!$11) {
                                                                     break block41
                                                                    }
                                                                    wasm2js_memory_copy(1, $15, $11);
                                                                    break block41;
                                                                   }
                                                                   _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                                                   $1 = 1;
                                                                   $16 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($11 | 0, 1 | 0) | 0;
                                                                   if ($16) {
                                                                    break block42
                                                                   }
                                                                   $16 = $11;
                                                                  }
                                                                  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $16 | 0);
                                                                  wasm2js_trap();
                                                                 }
                                                                 block43 : {
                                                                  if (!$11) {
                                                                   break block43
                                                                  }
                                                                  wasm2js_memory_copy($16, $15, $11);
                                                                 }
                                                                 $9 = $11 & 1 | 0;
                                                                 $1 = 0;
                                                                 block44 : {
                                                                  if (($11 | 0) == (1 | 0)) {
                                                                   break block44
                                                                  }
                                                                  $7 = $11 & 2147483646 | 0;
                                                                  $1 = 0;
                                                                  label : while (1) {
                                                                   $15 = $16 + $1 | 0;
                                                                   $6 = HEAPU8[$15 >> 0] | 0;
                                                                   HEAP8[$15 >> 0] = ((($6 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $6 | 0;
                                                                   $15 = $15 + 1 | 0;
                                                                   $194 = $15;
                                                                   $15 = HEAPU8[$15 >> 0] | 0;
                                                                   HEAP8[$194 >> 0] = ((($15 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $15 | 0;
                                                                   $1 = $1 + 2 | 0;
                                                                   if (($7 | 0) != ($1 | 0)) {
                                                                    continue label
                                                                   }
                                                                   break label;
                                                                  };
                                                                 }
                                                                 if (!$9) {
                                                                  break block41
                                                                 }
                                                                 $1 = $16 + $1 | 0;
                                                                 $214 = $1;
                                                                 $1 = HEAPU8[$1 >> 0] | 0;
                                                                 HEAP8[$214 >> 0] = ((($1 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $1 | 0;
                                                                }
                                                                block45 : {
                                                                 $15 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                                 if (($15 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                                  break block45
                                                                 }
                                                                 _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                                }
                                                                $1 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($15 << 4 | 0) | 0;
                                                                HEAP8[($1 + 12 | 0) >> 0] = 4;
                                                                HEAP32[($1 + 8 | 0) >> 2] = $11;
                                                                HEAP32[($1 + 4 | 0) >> 2] = $16;
                                                                HEAP32[$1 >> 2] = $11;
                                                                $7 = 0;
                                                                HEAP32[($3 + 32 | 0) >> 2] = 0;
                                                                HEAP32[($3 + 20 | 0) >> 2] = $15 + 1 | 0;
                                                                break block23;
                                                               case 1:
                                                                break block13;
                                                               case 2:
                                                                break block14;
                                                               case 5:
                                                                break block17;
                                                               case 7:
                                                                break block19;
                                                               case 9:
                                                                break block21;
                                                               default:
                                                                break block12;
                                                               };
                                                              }
                                                              if (!$11) {
                                                               break block46
                                                              }
                                                              break block24;
                                                             }
                                                             if (($10 | ($2 >>> 0 >= $6 >>> 0 | ($15 & 14 | 0 | 0) == (2 | 0) | 0) | 0 | 0) != (1 | 0)) {
                                                              break block38
                                                             }
                                                             $1 = 0;
                                                             block51 : {
                                                              block47 : {
                                                               $9 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                               if (($9 | 0) < (0 | 0)) {
                                                                break block47
                                                               }
                                                               $15 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                               block48 : {
                                                                if ($9) {
                                                                 break block48
                                                                }
                                                                $17 = 1;
                                                                block49 : {
                                                                 if (!$9) {
                                                                  break block49
                                                                 }
                                                                 wasm2js_memory_copy(1, $15, $9);
                                                                }
                                                                $6 = 0;
                                                                $11 = 4;
                                                                break block50;
                                                               }
                                                               _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                                               $1 = 1;
                                                               $17 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($9 | 0, 1 | 0) | 0;
                                                               if ($17) {
                                                                break block51
                                                               }
                                                               $17 = $9;
                                                              }
                                                              _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $17 | 0);
                                                              wasm2js_trap();
                                                             }
                                                             block52 : {
                                                              $11 = !$9;
                                                              if ($11) {
                                                               break block52
                                                              }
                                                              wasm2js_memory_copy($17, $15, $9);
                                                             }
                                                             $10 = $9 & 1 | 0;
                                                             block54 : {
                                                              block53 : {
                                                               $12 = $9 + -1 | 0;
                                                               if ($12) {
                                                                break block53
                                                               }
                                                               $1 = 0;
                                                               break block54;
                                                              }
                                                              $7 = $9 & 2147483646 | 0;
                                                              $1 = 0;
                                                              label1 : while (1) {
                                                               $15 = $17 + $1 | 0;
                                                               $6 = HEAPU8[$15 >> 0] | 0;
                                                               HEAP8[$15 >> 0] = ((($6 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $6 | 0;
                                                               $15 = $15 + 1 | 0;
                                                               $305 = $15;
                                                               $15 = HEAPU8[$15 >> 0] | 0;
                                                               HEAP8[$305 >> 0] = ((($15 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $15 | 0;
                                                               $1 = $1 + 2 | 0;
                                                               if (($7 | 0) != ($1 | 0)) {
                                                                continue label1
                                                               }
                                                               break label1;
                                                              };
                                                             }
                                                             block55 : {
                                                              if (!$10) {
                                                               break block55
                                                              }
                                                              $1 = $17 + $1 | 0;
                                                              $325 = $1;
                                                              $1 = HEAPU8[$1 >> 0] | 0;
                                                              HEAP8[$325 >> 0] = ((($1 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $1 | 0;
                                                             }
                                                             _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                                             $7 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($9 | 0, 1 | 0) | 0;
                                                             if (!$7) {
                                                              break block56
                                                             }
                                                             block57 : {
                                                              if ($11) {
                                                               break block57
                                                              }
                                                              wasm2js_memory_copy($7, $17, $9);
                                                             }
                                                             block59 : {
                                                              block58 : {
                                                               if ($12) {
                                                                break block58
                                                               }
                                                               $1 = 0;
                                                               break block59;
                                                              }
                                                              $11 = $9 & 2147483646 | 0;
                                                              $1 = 0;
                                                              label2 : while (1) {
                                                               $15 = $7 + $1 | 0;
                                                               $6 = HEAPU8[$15 >> 0] | 0;
                                                               HEAP8[$15 >> 0] = ((($6 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $6 | 0;
                                                               $15 = $15 + 1 | 0;
                                                               $361 = $15;
                                                               $15 = HEAPU8[$15 >> 0] | 0;
                                                               HEAP8[$361 >> 0] = ((($15 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $15 | 0;
                                                               $1 = $1 + 2 | 0;
                                                               if (($11 | 0) != ($1 | 0)) {
                                                                continue label2
                                                               }
                                                               break label2;
                                                              };
                                                             }
                                                             block60 : {
                                                              if (!$10) {
                                                               break block60
                                                              }
                                                              $1 = $7 + $1 | 0;
                                                              $381 = $1;
                                                              $1 = HEAPU8[$1 >> 0] | 0;
                                                              HEAP8[$381 >> 0] = ((($1 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $1 | 0;
                                                             }
                                                             block62 : {
                                                              block61 : {
                                                               $15 = HEAP8[$7 >> 0] | 0;
                                                               if (($15 | 0) <= (-1 | 0)) {
                                                                break block61
                                                               }
                                                               $1 = $7 + 1 | 0;
                                                               $15 = $15 & 255 | 0;
                                                               break block62;
                                                              }
                                                              $1 = (HEAPU8[($7 + 1 | 0) >> 0] | 0) & 63 | 0;
                                                              $6 = $15 & 31 | 0;
                                                              block63 : {
                                                               if ($15 >>> 0 > -33 >>> 0) {
                                                                break block63
                                                               }
                                                               $15 = $6 << 6 | 0 | $1 | 0;
                                                               $1 = $7 + 2 | 0;
                                                               break block62;
                                                              }
                                                              $1 = $1 << 6 | 0 | ((HEAPU8[($7 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                                                              block64 : {
                                                               if ($15 >>> 0 >= -16 >>> 0) {
                                                                break block64
                                                               }
                                                               $15 = $1 | ($6 << 12 | 0) | 0;
                                                               $1 = $7 + 3 | 0;
                                                               break block62;
                                                              }
                                                              $15 = $1 << 6 | 0 | ((HEAPU8[($7 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($6 << 18 | 0) & 1835008 | 0) | 0;
                                                              $1 = $7 + 4 | 0;
                                                             }
                                                             $6 = $7 + $9 | 0;
                                                             block66 : {
                                                              block65 : {
                                                               if (($15 | 0) == (1114113 | 0)) {
                                                                break block65
                                                               }
                                                               if (($15 | 0) != (36 | 0)) {
                                                                break block66
                                                               }
                                                              }
                                                              block67 : {
                                                               if (($1 | 0) != ($6 | 0)) {
                                                                break block67
                                                               }
                                                               $11 = 4;
                                                               break block68;
                                                              }
                                                              block69 : {
                                                               $15 = HEAP8[$1 >> 0] | 0;
                                                               if (($15 | 0) <= (-1 | 0)) {
                                                                break block69
                                                               }
                                                               $1 = $1 + 1 | 0;
                                                               $15 = $15 & 255 | 0;
                                                               break block70;
                                                              }
                                                              $11 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                                                              $10 = $15 & 31 | 0;
                                                              block71 : {
                                                               if ($15 >>> 0 > -33 >>> 0) {
                                                                break block71
                                                               }
                                                               $15 = $10 << 6 | 0 | $11 | 0;
                                                               $1 = $1 + 2 | 0;
                                                               break block70;
                                                              }
                                                              $11 = $11 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                                                              block72 : {
                                                               if ($15 >>> 0 >= -16 >>> 0) {
                                                                break block72
                                                               }
                                                               $15 = $11 | ($10 << 12 | 0) | 0;
                                                               $1 = $1 + 3 | 0;
                                                               break block70;
                                                              }
                                                              $15 = $11 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($10 << 18 | 0) & 1835008 | 0) | 0;
                                                              $1 = $1 + 4 | 0;
                                                             }
                                                             if (($15 | 0) != (1114112 | 0)) {
                                                              break block70
                                                             }
                                                             $11 = 4;
                                                             break block68;
                                                            }
                                                            if ($11) {
                                                             break block73
                                                            }
                                                            _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 64 | 0 | 0, $3 + 24 | 0 | 0);
                                                            block74 : {
                                                             $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                             if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                              break block74
                                                             }
                                                             _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                            }
                                                            $15 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                                            i64toi32_i32$2 = $3;
                                                            i64toi32_i32$0 = HEAP32[($3 + 64 | 0) >> 2] | 0;
                                                            i64toi32_i32$1 = HEAP32[($3 + 68 | 0) >> 2] | 0;
                                                            $517 = i64toi32_i32$0;
                                                            i64toi32_i32$0 = $15;
                                                            HEAP32[$15 >> 2] = $517;
                                                            HEAP32[($15 + 4 | 0) >> 2] = i64toi32_i32$1;
                                                            HEAP8[($15 + 12 | 0) >> 0] = 1;
                                                            HEAP32[($15 + 8 | 0) >> 2] = HEAP32[(($3 + 64 | 0) + 8 | 0) >> 2] | 0;
                                                            HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                                            break block75;
                                                           }
                                                           block77 : {
                                                            block76 : {
                                                             switch ($1 + -43 | 0 | 0) {
                                                             case 0:
                                                             case 2:
                                                              break block76;
                                                             default:
                                                              break block77;
                                                             };
                                                            }
                                                            $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                            if (!$6) {
                                                             break block77
                                                            }
                                                            block78 : {
                                                             $11 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                             $7 = $11 + $6 | 0;
                                                             $15 = HEAP8[($7 + -1 | 0) >> 0] | 0;
                                                             if (($15 | 0) > (-1 | 0)) {
                                                              break block78
                                                             }
                                                             block80 : {
                                                              block79 : {
                                                               $9 = HEAPU8[($7 + -2 | 0) >> 0] | 0;
                                                               $10 = $9 << 24 >> 24;
                                                               if (($10 | 0) < (-64 | 0)) {
                                                                break block79
                                                               }
                                                               $7 = $9 & 31 | 0;
                                                               break block80;
                                                              }
                                                              block82 : {
                                                               block81 : {
                                                                $9 = HEAPU8[($7 + -3 | 0) >> 0] | 0;
                                                                $12 = $9 << 24 >> 24;
                                                                if (($12 | 0) < (-64 | 0)) {
                                                                 break block81
                                                                }
                                                                $7 = $9 & 15 | 0;
                                                                break block82;
                                                               }
                                                               $7 = ((HEAPU8[($7 + -4 | 0) >> 0] | 0) & 7 | 0) << 6 | 0 | ($12 & 63 | 0) | 0;
                                                              }
                                                              $7 = $7 << 6 | 0 | ($10 & 63 | 0) | 0;
                                                             }
                                                             $15 = $7 << 6 | 0 | ($15 & 63 | 0) | 0;
                                                            }
                                                            if (((($15 + -65 | 0) >>> 0 < 26 >>> 0 ? $15 | 32 | 0 : $15) | 0) != (101 | 0)) {
                                                             break block77
                                                            }
                                                            $15 = $6;
                                                            block83 : {
                                                             if ((HEAP32[($3 + 24 | 0) >> 2] | 0 | 0) != ($15 | 0)) {
                                                              break block83
                                                             }
                                                             _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $15 | 0, 1 | 0, 1 | 0, 1 | 0);
                                                             $15 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                             $11 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                            }
                                                            HEAP8[($11 + $15 | 0) >> 0] = $1;
                                                            HEAP32[($3 + 32 | 0) >> 2] = $6 + 1 | 0;
                                                            $2 = $2 + 1 | 0;
                                                            $7 = 6;
                                                            break block23;
                                                           }
                                                           _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 64 | 0 | 0, $3 + 24 | 0 | 0);
                                                           block84 : {
                                                            $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                            if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                             break block84
                                                            }
                                                            _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                           }
                                                           $15 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                                           i64toi32_i32$2 = $3;
                                                           i64toi32_i32$1 = HEAP32[($3 + 64 | 0) >> 2] | 0;
                                                           i64toi32_i32$0 = HEAP32[($3 + 68 | 0) >> 2] | 0;
                                                           $628 = i64toi32_i32$1;
                                                           i64toi32_i32$1 = $15;
                                                           HEAP32[$15 >> 2] = $628;
                                                           HEAP32[($15 + 4 | 0) >> 2] = i64toi32_i32$0;
                                                           HEAP8[($15 + 12 | 0) >> 0] = 1;
                                                           HEAP32[($15 + 8 | 0) >> 2] = HEAP32[(($3 + 64 | 0) + 8 | 0) >> 2] | 0;
                                                           HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                                           break block75;
                                                          }
                                                          if ($11) {
                                                           break block85
                                                          }
                                                          block87 : {
                                                           block89 : {
                                                            block88 : {
                                                             block86 : {
                                                              if (!($14 & 1 | 0)) {
                                                               break block86
                                                              }
                                                              if (($1 & 2097119 | 0 | 0) != (69 | 0)) {
                                                               break block87
                                                              }
                                                              $11 = $1 >>> 0 < 128 >>> 0;
                                                              if (!$11) {
                                                               break block88
                                                              }
                                                              $15 = 1;
                                                              break block89;
                                                             }
                                                             block91 : {
                                                              block90 : {
                                                               $11 = $1 >>> 0 < 128 >>> 0;
                                                               if (!$11) {
                                                                break block90
                                                               }
                                                               $15 = 1;
                                                               break block91;
                                                              }
                                                              block92 : {
                                                               if ($1 >>> 0 >= 2048 >>> 0) {
                                                                break block92
                                                               }
                                                               $15 = 2;
                                                               break block91;
                                                              }
                                                              $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                             }
                                                             $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                             $7 = $6;
                                                             block93 : {
                                                              if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                               break block93
                                                              }
                                                              _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                              $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                             }
                                                             $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                             if ($11) {
                                                              break block94
                                                             }
                                                             $11 = $1 & 63 | 0 | -128 | 0;
                                                             $9 = $1 >>> 6 | 0;
                                                             block95 : {
                                                              if ($1 >>> 0 >= 2048 >>> 0) {
                                                               break block95
                                                              }
                                                              HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                              HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                              break block96;
                                                             }
                                                             $10 = $1 >>> 12 | 0;
                                                             $9 = $9 & 63 | 0 | -128 | 0;
                                                             block97 : {
                                                              if ($1 >>> 0 > 65535 >>> 0) {
                                                               break block97
                                                              }
                                                              HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                              HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                              HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                              break block96;
                                                             }
                                                             HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                             HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                             HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                             HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                             break block96;
                                                            }
                                                            block98 : {
                                                             if ($1 >>> 0 >= 2048 >>> 0) {
                                                              break block98
                                                             }
                                                             $15 = 2;
                                                             break block89;
                                                            }
                                                            $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                           }
                                                           $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                           $7 = $6;
                                                           block99 : {
                                                            if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                             break block99
                                                            }
                                                            _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                            $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                           }
                                                           $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                           if ($11) {
                                                            break block100
                                                           }
                                                           $11 = $1 & 37 | 0 | -128 | 0;
                                                           block101 : {
                                                            if ($1 >>> 0 >= 2048 >>> 0) {
                                                             break block101
                                                            }
                                                            HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                            HEAP8[$7 >> 0] = 193;
                                                            break block102;
                                                           }
                                                           block103 : {
                                                            if ($1 >>> 0 > 65535 >>> 0) {
                                                             break block103
                                                            }
                                                            HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                            $47 = 33248;
                                                            HEAP8[$7 >> 0] = $47;
                                                            HEAP8[($7 + 1 | 0) >> 0] = $47 >>> 8 | 0;
                                                            break block102;
                                                           }
                                                           HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                           HEAP8[($7 + 2 | 0) >> 0] = 129;
                                                           $48 = 33008;
                                                           HEAP8[$7 >> 0] = $48;
                                                           HEAP8[($7 + 1 | 0) >> 0] = $48 >>> 8 | 0;
                                                           break block102;
                                                          }
                                                          _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 64 | 0 | 0, $3 + 24 | 0 | 0);
                                                          block104 : {
                                                           $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                           if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                            break block104
                                                           }
                                                           _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                          }
                                                          $6 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                                          i64toi32_i32$2 = $3;
                                                          i64toi32_i32$0 = HEAP32[($3 + 64 | 0) >> 2] | 0;
                                                          i64toi32_i32$1 = HEAP32[($3 + 68 | 0) >> 2] | 0;
                                                          $778 = i64toi32_i32$0;
                                                          i64toi32_i32$0 = $6;
                                                          HEAP32[$6 >> 2] = $778;
                                                          HEAP32[($6 + 4 | 0) >> 2] = i64toi32_i32$1;
                                                          HEAP8[($6 + 12 | 0) >> 0] = 1;
                                                          HEAP32[($6 + 8 | 0) >> 2] = HEAP32[(($3 + 64 | 0) + 8 | 0) >> 2] | 0;
                                                          HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                                          $8 = 0;
                                                          HEAP32[($3 + 32 | 0) >> 2] = 0;
                                                         }
                                                         switch ($15 + -1 | 0 | 0) {
                                                         case 0:
                                                          break block105;
                                                         case 1:
                                                          break block106;
                                                         default:
                                                          break block107;
                                                         };
                                                        }
                                                        $7 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                        block108 : {
                                                         $15 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                         if (!$15) {
                                                          break block108
                                                         }
                                                         if ((HEAPU8[(($7 + $15 | 0) + -1 | 0) >> 0] | 0 | 0) == (33 | 0)) {
                                                          break block109
                                                         }
                                                        }
                                                        if ($2 >>> 0 >= $6 >>> 0) {
                                                         break block38
                                                        }
                                                        $9 = $1 >>> 0 < 128 >>> 0;
                                                        if (!$9) {
                                                         break block110
                                                        }
                                                        $6 = 1;
                                                        break block111;
                                                       }
                                                       block113 : {
                                                        block112 : {
                                                         $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
                                                         $11 = $1 >>> 0 < 128 >>> 0;
                                                         if (!$11) {
                                                          break block112
                                                         }
                                                         $15 = 1;
                                                         break block113;
                                                        }
                                                        block114 : {
                                                         if ($1 >>> 0 >= 2048 >>> 0) {
                                                          break block114
                                                         }
                                                         $15 = 2;
                                                         break block113;
                                                        }
                                                        $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                       }
                                                       $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                       $7 = $6;
                                                       block115 : {
                                                        if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                         break block115
                                                        }
                                                        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                        $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                       }
                                                       $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                       if ($11) {
                                                        break block116
                                                       }
                                                       $11 = $1 & 63 | 0 | -128 | 0;
                                                       $9 = $1 >>> 6 | 0;
                                                       block117 : {
                                                        if ($1 >>> 0 >= 2048 >>> 0) {
                                                         break block117
                                                        }
                                                        HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                        HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                        break block118;
                                                       }
                                                       $10 = $1 >>> 12 | 0;
                                                       $9 = $9 & 63 | 0 | -128 | 0;
                                                       block119 : {
                                                        if ($1 >>> 0 > 65535 >>> 0) {
                                                         break block119
                                                        }
                                                        HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                        HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                        HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                        break block118;
                                                       }
                                                       HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                       HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                       HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                       HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                       break block118;
                                                      }
                                                      block121 : {
                                                       block120 : {
                                                        $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
                                                        $11 = $1 >>> 0 < 128 >>> 0;
                                                        if (!$11) {
                                                         break block120
                                                        }
                                                        $15 = 1;
                                                        break block121;
                                                       }
                                                       block122 : {
                                                        if ($1 >>> 0 >= 2048 >>> 0) {
                                                         break block122
                                                        }
                                                        $15 = 2;
                                                        break block121;
                                                       }
                                                       $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                      }
                                                      $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                      $7 = $6;
                                                      block123 : {
                                                       if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                        break block123
                                                       }
                                                       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                       $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                      }
                                                      $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                      if ($11) {
                                                       break block124
                                                      }
                                                      $11 = $1 & 63 | 0 | -128 | 0;
                                                      $9 = $1 >>> 6 | 0;
                                                      block125 : {
                                                       if ($1 >>> 0 >= 2048 >>> 0) {
                                                        break block125
                                                       }
                                                       HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                       HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                       break block126;
                                                      }
                                                      $10 = $1 >>> 12 | 0;
                                                      $9 = $9 & 63 | 0 | -128 | 0;
                                                      block127 : {
                                                       if ($1 >>> 0 > 65535 >>> 0) {
                                                        break block127
                                                       }
                                                       HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                       HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                       HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                       break block126;
                                                      }
                                                      HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                      HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                      HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                      HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                      break block126;
                                                     }
                                                     block128 : {
                                                      if (($15 + -5 | 0) >>> 0 > 1 >>> 0) {
                                                       break block128
                                                      }
                                                      block130 : {
                                                       block129 : {
                                                        $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
                                                        $11 = $1 >>> 0 < 128 >>> 0;
                                                        if (!$11) {
                                                         break block129
                                                        }
                                                        $15 = 1;
                                                        break block130;
                                                       }
                                                       block131 : {
                                                        if ($1 >>> 0 >= 2048 >>> 0) {
                                                         break block131
                                                        }
                                                        $15 = 2;
                                                        break block130;
                                                       }
                                                       $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                      }
                                                      $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                      $7 = $6;
                                                      block132 : {
                                                       if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                        break block132
                                                       }
                                                       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                       $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                      }
                                                      $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                      if ($11) {
                                                       break block133
                                                      }
                                                      $11 = $1 & 63 | 0 | -128 | 0;
                                                      $9 = $1 >>> 6 | 0;
                                                      block134 : {
                                                       if ($1 >>> 0 >= 2048 >>> 0) {
                                                        break block134
                                                       }
                                                       HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                       HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                       break block135;
                                                      }
                                                      $10 = $1 >>> 12 | 0;
                                                      $9 = $9 & 63 | 0 | -128 | 0;
                                                      block136 : {
                                                       if ($1 >>> 0 > 65535 >>> 0) {
                                                        break block136
                                                       }
                                                       HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                       HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                       HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                       break block135;
                                                      }
                                                      HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                      HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                      HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                      HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                      break block135;
                                                     }
                                                     block139 : {
                                                      switch ($15 + -3 | 0 | 0) {
                                                      case 7:
                                                       block142 : {
                                                        block141 : {
                                                         $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
                                                         $11 = $1 >>> 0 < 128 >>> 0;
                                                         if (!$11) {
                                                          break block141
                                                         }
                                                         $15 = 1;
                                                         break block142;
                                                        }
                                                        block143 : {
                                                         if ($1 >>> 0 >= 2048 >>> 0) {
                                                          break block143
                                                         }
                                                         $15 = 2;
                                                         break block142;
                                                        }
                                                        $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                       }
                                                       $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                       $7 = $6;
                                                       block144 : {
                                                        if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                                                         break block144
                                                        }
                                                        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                                                        $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                       }
                                                       $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                                                       if ($11) {
                                                        break block145
                                                       }
                                                       $11 = $1 & 63 | 0 | -128 | 0;
                                                       $9 = $1 >>> 6 | 0;
                                                       block146 : {
                                                        if ($1 >>> 0 >= 2048 >>> 0) {
                                                         break block146
                                                        }
                                                        HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                        HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                        break block147;
                                                       }
                                                       $10 = $1 >>> 12 | 0;
                                                       $9 = $9 & 63 | 0 | -128 | 0;
                                                       block148 : {
                                                        if ($1 >>> 0 > 65535 >>> 0) {
                                                         break block148
                                                        }
                                                        HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                        HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                        HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                        break block147;
                                                       }
                                                       HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                       HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                       HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                       HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                       break block147;
                                                      case 0:
                                                       HEAP32[($3 + 64 | 0) >> 2] = 0;
                                                       $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
                                                       if ($1 >>> 0 < 128 >>> 0) {
                                                        break block149
                                                       }
                                                       $15 = $1 & 63 | 0 | -128 | 0;
                                                       $6 = $1 >>> 6 | 0;
                                                       block150 : {
                                                        if ($1 >>> 0 >= 2048 >>> 0) {
                                                         break block150
                                                        }
                                                        HEAP8[($3 + 65 | 0) >> 0] = $15;
                                                        HEAP8[($3 + 64 | 0) >> 0] = $6 | 192 | 0;
                                                        $1 = 2;
                                                        break block151;
                                                       }
                                                       $7 = $1 >>> 12 | 0;
                                                       $6 = $6 & 63 | 0 | -128 | 0;
                                                       block152 : {
                                                        if ($1 >>> 0 > 65535 >>> 0) {
                                                         break block152
                                                        }
                                                        HEAP8[($3 + 66 | 0) >> 0] = $15;
                                                        HEAP8[($3 + 65 | 0) >> 0] = $6;
                                                        HEAP8[($3 + 64 | 0) >> 0] = $7 | 224 | 0;
                                                        $1 = 3;
                                                        break block151;
                                                       }
                                                       HEAP8[($3 + 67 | 0) >> 0] = $15;
                                                       HEAP8[($3 + 66 | 0) >> 0] = $6;
                                                       HEAP8[($3 + 65 | 0) >> 0] = $7 & 63 | 0 | -128 | 0;
                                                       HEAP8[($3 + 64 | 0) >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                       $1 = 4;
                                                       break block151;
                                                      case 5:
                                                       break block139;
                                                      default:
                                                       break block138;
                                                      };
                                                     }
                                                     HEAP32[($3 + 32 | 0) >> 2] = 0;
                                                     break block153;
                                                    }
                                                    block154 : {
                                                     if ($1 >>> 0 >= 2048 >>> 0) {
                                                      break block154
                                                     }
                                                     $6 = 2;
                                                     break block111;
                                                    }
                                                    $6 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                                                   }
                                                   $11 = $15;
                                                   block155 : {
                                                    if ($6 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $15 | 0) >>> 0) {
                                                     break block155
                                                    }
                                                    _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $15 | 0, $6 | 0, 1 | 0, 1 | 0);
                                                    $11 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                                    $7 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                                                   }
                                                   $7 = $7 + $11 | 0;
                                                   if ($9) {
                                                    break block156
                                                   }
                                                   $11 = $1 & 63 | 0 | -128 | 0;
                                                   $9 = $1 >>> 6 | 0;
                                                   block157 : {
                                                    if ($1 >>> 0 >= 2048 >>> 0) {
                                                     break block157
                                                    }
                                                    HEAP8[($7 + 1 | 0) >> 0] = $11;
                                                    HEAP8[$7 >> 0] = $9 | 192 | 0;
                                                    break block158;
                                                   }
                                                   $10 = $1 >>> 12 | 0;
                                                   $9 = $9 & 63 | 0 | -128 | 0;
                                                   block159 : {
                                                    if ($1 >>> 0 > 65535 >>> 0) {
                                                     break block159
                                                    }
                                                    HEAP8[($7 + 2 | 0) >> 0] = $11;
                                                    HEAP8[($7 + 1 | 0) >> 0] = $9;
                                                    HEAP8[$7 >> 0] = $10 | 224 | 0;
                                                    break block158;
                                                   }
                                                   HEAP8[($7 + 3 | 0) >> 0] = $11;
                                                   HEAP8[($7 + 2 | 0) >> 0] = $9;
                                                   HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                                                   HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                                                   break block158;
                                                  }
                                                  _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 64 | 0 | 0, $3 + 24 | 0 | 0);
                                                  block160 : {
                                                   $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                   if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                    break block160
                                                   }
                                                   _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                  }
                                                  $15 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                                  i64toi32_i32$2 = $3;
                                                  i64toi32_i32$1 = HEAP32[($3 + 64 | 0) >> 2] | 0;
                                                  i64toi32_i32$0 = HEAP32[($3 + 68 | 0) >> 2] | 0;
                                                  $1217 = i64toi32_i32$1;
                                                  i64toi32_i32$1 = $15;
                                                  HEAP32[$15 >> 2] = $1217;
                                                  HEAP32[($15 + 4 | 0) >> 2] = i64toi32_i32$0;
                                                  HEAP8[($15 + 12 | 0) >> 0] = 4;
                                                  HEAP32[($15 + 8 | 0) >> 2] = HEAP32[(($3 + 64 | 0) + 8 | 0) >> 2] | 0;
                                                  HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                                  break block75;
                                                 }
                                                 if ($9) {
                                                  break block161
                                                 }
                                                 _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 64 | 0 | 0, $3 + 24 | 0 | 0);
                                                 block162 : {
                                                  $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                                  if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                                   break block162
                                                  }
                                                  _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                                 }
                                                 $15 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                                 i64toi32_i32$2 = $3;
                                                 i64toi32_i32$0 = HEAP32[($3 + 64 | 0) >> 2] | 0;
                                                 i64toi32_i32$1 = HEAP32[($3 + 68 | 0) >> 2] | 0;
                                                 $1248 = i64toi32_i32$0;
                                                 i64toi32_i32$0 = $15;
                                                 HEAP32[$15 >> 2] = $1248;
                                                 HEAP32[($15 + 4 | 0) >> 2] = i64toi32_i32$1;
                                                 HEAP8[($15 + 12 | 0) >> 0] = 6;
                                                 HEAP32[($15 + 8 | 0) >> 2] = HEAP32[(($3 + 64 | 0) + 8 | 0) >> 2] | 0;
                                                 HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                                 break block75;
                                                }
                                                HEAP8[$7 >> 0] = $1;
                                                break block34;
                                               }
                                               _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, $9 | 0);
                                               wasm2js_trap();
                                              }
                                              HEAP8[$7 >> 0] = $1;
                                              break block96;
                                             }
                                             HEAP8[$7 >> 0] = $1;
                                             break block102;
                                            }
                                            HEAP8[$7 >> 0] = $1;
                                            break block118;
                                           }
                                           HEAP8[$7 >> 0] = $1;
                                           break block126;
                                          }
                                          HEAP8[$7 >> 0] = $1;
                                          break block135;
                                         }
                                         HEAP8[$7 >> 0] = $1;
                                         break block147;
                                        }
                                        HEAP8[($3 + 64 | 0) >> 0] = $1;
                                        $1 = 1;
                                        break block151;
                                       }
                                       HEAP8[$7 >> 0] = $1;
                                       break block158;
                                      }
                                      $1 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                      $15 = $1;
                                      block163 : {
                                       if ((HEAP32[($3 + 24 | 0) >> 2] | 0 | 0) != ($1 | 0)) {
                                        break block163
                                       }
                                       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $1 | 0, 1 | 0, 1 | 0, 1 | 0);
                                       $15 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                                      }
                                      HEAP8[((HEAP32[($3 + 28 | 0) >> 2] | 0) + $15 | 0) >> 0] = 34;
                                      HEAP32[($3 + 32 | 0) >> 2] = $1 + 1 | 0;
                                      break block153;
                                     }
                                     HEAP32[($3 + 32 | 0) >> 2] = $6 + $15 | 0;
                                     break block164;
                                    }
                                    _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                    block171 : {
                                     block167 : {
                                      block169 : {
                                       block165 : {
                                        $15 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($1 | 0, 1 | 0) | 0;
                                        if (!$15) {
                                         break block165
                                        }
                                        block166 : {
                                         if (!$1) {
                                          break block166
                                         }
                                         wasm2js_memory_copy($15, $3 + 64 | 0, $1);
                                        }
                                        HEAP32[($3 + 48 | 0) >> 2] = $1;
                                        HEAP32[($3 + 44 | 0) >> 2] = $15;
                                        HEAP32[($3 + 40 | 0) >> 2] = $1;
                                        $6 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                        if (!$6) {
                                         break block167
                                        }
                                        $6 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($6 << 4 | 0) | 0;
                                        if ((HEAPU8[($6 + -4 | 0) >> 0] | 0 | 0) != (3 | 0)) {
                                         break block167
                                        }
                                        i64toi32_i32$1 = $5$hi;
                                        i64toi32_i32$0 = $3;
                                        HEAP32[($3 + 72 | 0) >> 2] = $5;
                                        HEAP32[($3 + 76 | 0) >> 2] = i64toi32_i32$1;
                                        i64toi32_i32$1 = $4$hi;
                                        i64toi32_i32$1 = 0;
                                        $1336$hi = i64toi32_i32$1;
                                        i64toi32_i32$1 = $4$hi;
                                        i64toi32_i32$2 = $4;
                                        i64toi32_i32$0 = $1336$hi;
                                        i64toi32_i32$3 = $6 + -16 | 0;
                                        i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
                                        $1337 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
                                        i64toi32_i32$2 = $3;
                                        HEAP32[($3 + 64 | 0) >> 2] = $1337;
                                        HEAP32[($3 + 68 | 0) >> 2] = i64toi32_i32$0;
                                        _ZN5alloc3fmt6format12format_inner17h32c4432df66cb685E($3 + 52 | 0 | 0, 1048576 | 0, $3 + 64 | 0 | 0);
                                        $6 = HEAP32[($3 + 52 | 0) >> 2] | 0;
                                        $7 = HEAP32[($3 + 56 | 0) >> 2] | 0;
                                        block168 : {
                                         if ((HEAP32[($3 + 60 | 0) >> 2] | 0 | 0) != (2 | 0)) {
                                          break block168
                                         }
                                         if ((HEAPU8[$7 >> 0] | 0 | ((HEAPU8[($7 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) == (15676 | 0)) {
                                          break block169
                                         }
                                         if ((HEAPU8[$7 >> 0] | 0 | ((HEAPU8[($7 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) == (15678 | 0)) {
                                          break block169
                                         }
                                         if ((HEAPU8[$7 >> 0] | 0 | ((HEAPU8[($7 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) == (15932 | 0)) {
                                          break block169
                                         }
                                        }
                                        if (!$6) {
                                         break block167
                                        }
                                        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($7 | 0, $6 | 0, 1 | 0);
                                        break block167;
                                       }
                                       _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, $1 | 0);
                                       wasm2js_trap();
                                      }
                                      block170 : {
                                       $11 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                       if (!$11) {
                                        break block170
                                       }
                                       $11 = $11 + -1 | 0;
                                       HEAP32[($3 + 20 | 0) >> 2] = $11;
                                       $11 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($11 << 4 | 0) | 0;
                                       $9 = HEAP32[$11 >> 2] | 0;
                                       if (($9 | -2147483648 | 0 | 0) == (-2147483648 | 0)) {
                                        break block170
                                       }
                                       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($11 + 4 | 0) >> 2] | 0 | 0, $9 | 0, 1 | 0);
                                      }
                                      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($15 | 0, $1 | 0, 1 | 0);
                                      HEAP32[($3 + 48 | 0) >> 2] = 2;
                                      HEAP32[($3 + 44 | 0) >> 2] = $7;
                                      HEAP32[($3 + 40 | 0) >> 2] = $6;
                                      break block171;
                                     }
                                     $7 = $15;
                                     $6 = $1;
                                    }
                                    _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($3 + 84 | 0 | 0, $3 + 40 | 0 | 0);
                                    block172 : {
                                     if ((HEAP32[($3 + 92 | 0) >> 2] | 0 | 0) != (2 | 0)) {
                                      break block172
                                     }
                                     block176 : {
                                      block178 : {
                                       block175 : {
                                        block173 : {
                                         $1 = HEAP32[($3 + 88 | 0) >> 2] | 0;
                                         if ((HEAPU8[$1 >> 0] | 0 | ((HEAPU8[($1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) == (15678 | 0)) {
                                          break block173
                                         }
                                         block174 : {
                                          if ((HEAPU8[$1 >> 0] | 0 | ((HEAPU8[($1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) == (15676 | 0)) {
                                           break block174
                                          }
                                          if ((HEAPU8[$1 >> 0] | 0 | ((HEAPU8[($1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | 0) != (15932 | 0)) {
                                           break block172
                                          }
                                          _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                          $15 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(1 | 0, 1 | 0) | 0;
                                          if (!$15) {
                                           break block175
                                          }
                                          HEAP8[$15 >> 0] = 78;
                                          break block176;
                                         }
                                         _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                         $15 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(1 | 0, 1 | 0) | 0;
                                         if (!$15) {
                                          break block177
                                         }
                                         HEAP8[$15 >> 0] = 76;
                                         break block176;
                                        }
                                        _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                                        $15 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(1 | 0, 1 | 0) | 0;
                                        if (!$15) {
                                         break block178
                                        }
                                        HEAP8[$15 >> 0] = 71;
                                        break block176;
                                       }
                                       _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 1 | 0);
                                       wasm2js_trap();
                                      }
                                      _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 1 | 0);
                                      wasm2js_trap();
                                     }
                                     block179 : {
                                      $11 = HEAP32[($3 + 84 | 0) >> 2] | 0;
                                      if (!$11) {
                                       break block179
                                      }
                                      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($1 | 0, $11 | 0, 1 | 0);
                                     }
                                     HEAP32[($3 + 92 | 0) >> 2] = 1;
                                     HEAP32[($3 + 88 | 0) >> 2] = $15;
                                     HEAP32[($3 + 84 | 0) >> 2] = 1;
                                    }
                                    block180 : {
                                     $1 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                                     if (($1 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                                      break block180
                                     }
                                     _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                                    }
                                    $15 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($1 << 4 | 0) | 0;
                                    i64toi32_i32$1 = $3;
                                    i64toi32_i32$0 = HEAP32[($3 + 84 | 0) >> 2] | 0;
                                    i64toi32_i32$2 = HEAP32[($3 + 88 | 0) >> 2] | 0;
                                    $1448 = i64toi32_i32$0;
                                    i64toi32_i32$0 = $15;
                                    HEAP32[$15 >> 2] = $1448;
                                    HEAP32[($15 + 4 | 0) >> 2] = i64toi32_i32$2;
                                    HEAP8[($15 + 12 | 0) >> 0] = 3;
                                    HEAP32[($15 + 8 | 0) >> 2] = HEAP32[(($3 + 84 | 0) + 8 | 0) >> 2] | 0;
                                    HEAP32[($3 + 20 | 0) >> 2] = $1 + 1 | 0;
                                    if (!$6) {
                                     break block138
                                    }
                                    _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($7 | 0, $6 | 0, 1 | 0);
                                   }
                                   $2 = $2 + 1 | 0;
                                   break block38;
                                  }
                                  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 1 | 0);
                                  wasm2js_trap();
                                 }
                                 HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                                }
                                $2 = $2 + 1 | 0;
                                $7 = 9;
                                break block23;
                               }
                               HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                               break block181;
                              }
                              HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                              break block182;
                             }
                             HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                             break block183;
                            }
                            HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                            $2 = $2 + 1 | 0;
                            $7 = 6;
                            $8 = 0;
                            break block23;
                           }
                           HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                          }
                          $8 = 1;
                          $2 = $2 + 1 | 0;
                          $7 = 1;
                          break block23;
                         }
                         block185 : {
                          block184 : {
                           $11 = $1 >>> 0 < 128 >>> 0;
                           if (!$11) {
                            break block184
                           }
                           $15 = 1;
                           break block185;
                          }
                          block186 : {
                           if ($1 >>> 0 >= 2048 >>> 0) {
                            break block186
                           }
                           $15 = 2;
                           break block185;
                          }
                          $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                         }
                         $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                         $7 = $6;
                         block187 : {
                          if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                           break block187
                          }
                          _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                          $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                         }
                         $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                         block190 : {
                          block188 : {
                           if ($11) {
                            break block188
                           }
                           $11 = $1 & 63 | 0 | -128 | 0;
                           $9 = $1 >>> 6 | 0;
                           block189 : {
                            if ($1 >>> 0 >= 2048 >>> 0) {
                             break block189
                            }
                            HEAP8[($7 + 1 | 0) >> 0] = $11;
                            HEAP8[$7 >> 0] = $9 | 192 | 0;
                            break block190;
                           }
                           $10 = $1 >>> 12 | 0;
                           $9 = $9 & 63 | 0 | -128 | 0;
                           block191 : {
                            if ($1 >>> 0 > 65535 >>> 0) {
                             break block191
                            }
                            HEAP8[($7 + 2 | 0) >> 0] = $11;
                            HEAP8[($7 + 1 | 0) >> 0] = $9;
                            HEAP8[$7 >> 0] = $10 | 224 | 0;
                            break block190;
                           }
                           HEAP8[($7 + 3 | 0) >> 0] = $11;
                           HEAP8[($7 + 2 | 0) >> 0] = $9;
                           HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                           HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                           break block190;
                          }
                          HEAP8[$7 >> 0] = $1;
                         }
                         HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                        }
                        $7 = 1;
                        $2 = $2 + 1 | 0;
                        break block23;
                       }
                       $7 = 0;
                       HEAP32[($3 + 32 | 0) >> 2] = 0;
                       break block23;
                      }
                      block193 : {
                       block192 : {
                        $11 = $1 >>> 0 < 128 >>> 0;
                        if (!$11) {
                         break block192
                        }
                        $15 = 1;
                        break block193;
                       }
                       block194 : {
                        if ($1 >>> 0 >= 2048 >>> 0) {
                         break block194
                        }
                        $15 = 2;
                        break block193;
                       }
                       $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                      }
                      $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                      $7 = $6;
                      block195 : {
                       if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                        break block195
                       }
                       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                       $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                      }
                      $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                      block198 : {
                       block196 : {
                        if ($11) {
                         break block196
                        }
                        $11 = $1 & 63 | 0 | -128 | 0;
                        $9 = $1 >>> 6 | 0;
                        block197 : {
                         if ($1 >>> 0 >= 2048 >>> 0) {
                          break block197
                         }
                         HEAP8[($7 + 1 | 0) >> 0] = $11;
                         HEAP8[$7 >> 0] = $9 | 192 | 0;
                         break block198;
                        }
                        $10 = $1 >>> 12 | 0;
                        $9 = $9 & 63 | 0 | -128 | 0;
                        block199 : {
                         if ($1 >>> 0 > 65535 >>> 0) {
                          break block199
                         }
                         HEAP8[($7 + 2 | 0) >> 0] = $11;
                         HEAP8[($7 + 1 | 0) >> 0] = $9;
                         HEAP8[$7 >> 0] = $10 | 224 | 0;
                         break block198;
                        }
                        HEAP8[($7 + 3 | 0) >> 0] = $11;
                        HEAP8[($7 + 2 | 0) >> 0] = $9;
                        HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                        HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                        break block198;
                       }
                       HEAP8[$7 >> 0] = $1;
                      }
                      HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
                      $2 = $2 + 1 | 0;
                      $7 = 7;
                      break block23;
                     }
                     $11 = 4;
                     if ((($15 & 2097119 | 0) + -91 | 0) >>> 0 < -26 >>> 0) {
                      break block68
                     }
                     if (($1 | 0) == ($6 | 0)) {
                      break block68
                     }
                     block202 : {
                      block200 : {
                       $15 = HEAP8[$1 >> 0] | 0;
                       if (($15 | 0) > (-1 | 0)) {
                        break block200
                       }
                       $10 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                       $12 = $15 & 31 | 0;
                       block201 : {
                        if ($15 >>> 0 >= -32 >>> 0) {
                         break block201
                        }
                        $15 = $12 << 6 | 0 | $10 | 0;
                        $1 = $1 + 2 | 0;
                        break block202;
                       }
                       $10 = $10 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                       block203 : {
                        if ($15 >>> 0 >= -16 >>> 0) {
                         break block203
                        }
                        $15 = $10 | ($12 << 12 | 0) | 0;
                        $1 = $1 + 3 | 0;
                        break block202;
                       }
                       block204 : {
                        $15 = $10 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($12 << 18 | 0) & 1835008 | 0) | 0;
                        if (($15 | 0) != (1114112 | 0)) {
                         break block204
                        }
                        $11 = 4;
                        break block68;
                       }
                       $1 = $1 + 4 | 0;
                       break block202;
                      }
                      $1 = $1 + 1 | 0;
                      $15 = $15 & 255 | 0;
                     }
                     block206 : {
                      block205 : {
                       if (($15 | 0) == (1114113 | 0)) {
                        break block205
                       }
                       if ((($15 & 2097119 | 0) + -65 | 0) >>> 0 >= 26 >>> 0) {
                        break block206
                       }
                      }
                      if (($1 | 0) == ($6 | 0)) {
                       break block68
                      }
                      block207 : {
                       $15 = HEAP8[$1 >> 0] | 0;
                       if (($15 | 0) <= (-1 | 0)) {
                        break block207
                       }
                       $1 = $1 + 1 | 0;
                       $15 = $15 & 255 | 0;
                       break block206;
                      }
                      $10 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                      $12 = $15 & 31 | 0;
                      block208 : {
                       if ($15 >>> 0 > -33 >>> 0) {
                        break block208
                       }
                       $15 = $12 << 6 | 0 | $10 | 0;
                       $1 = $1 + 2 | 0;
                       break block206;
                      }
                      $10 = $10 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                      block209 : {
                       if ($15 >>> 0 >= -16 >>> 0) {
                        break block209
                       }
                       $15 = $10 | ($12 << 12 | 0) | 0;
                       $1 = $1 + 3 | 0;
                       break block206;
                      }
                      $15 = $10 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($12 << 18 | 0) & 1835008 | 0) | 0;
                      $1 = $1 + 4 | 0;
                     }
                     block213 : {
                      block211 : {
                       block210 : {
                        if (($15 | 0) == (1114113 | 0)) {
                         break block210
                        }
                        if (($15 | 0) != (36 | 0)) {
                         break block211
                        }
                       }
                       if (($1 | 0) == ($6 | 0)) {
                        break block68
                       }
                       block212 : {
                        $15 = HEAP8[$1 >> 0] | 0;
                        if (($15 | 0) <= (-1 | 0)) {
                         break block212
                        }
                        $1 = $1 + 1 | 0;
                        $15 = $15 & 255 | 0;
                        break block213;
                       }
                       $10 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                       $12 = $15 & 31 | 0;
                       block214 : {
                        if ($15 >>> 0 > -33 >>> 0) {
                         break block214
                        }
                        $15 = $12 << 6 | 0 | $10 | 0;
                        $1 = $1 + 2 | 0;
                        break block213;
                       }
                       $10 = $10 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                       block215 : {
                        if ($15 >>> 0 >= -16 >>> 0) {
                         break block215
                        }
                        $15 = $10 | ($12 << 12 | 0) | 0;
                        $1 = $1 + 3 | 0;
                        break block213;
                       }
                       $15 = $10 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($12 << 18 | 0) & 1835008 | 0) | 0;
                       $1 = $1 + 4 | 0;
                      }
                      if (($15 | 0) == (1114112 | 0)) {
                       break block68
                      }
                     }
                     if (($15 + -49 | 0) >>> 0 > 8 >>> 0) {
                      break block68
                     }
                     block216 : {
                      label3 : while (1) {
                       $15 = 1114112;
                       if (($1 | 0) == ($6 | 0)) {
                        break block216
                       }
                       block218 : {
                        block217 : {
                         $15 = HEAP8[$1 >> 0] | 0;
                         if (($15 | 0) <= (-1 | 0)) {
                          break block217
                         }
                         $1 = $1 + 1 | 0;
                         $15 = $15 & 255 | 0;
                         break block218;
                        }
                        $11 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                        $10 = $15 & 31 | 0;
                        block219 : {
                         if ($15 >>> 0 > -33 >>> 0) {
                          break block219
                         }
                         $15 = $10 << 6 | 0 | $11 | 0;
                         $1 = $1 + 2 | 0;
                         break block218;
                        }
                        $11 = $11 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                        block220 : {
                         if ($15 >>> 0 >= -16 >>> 0) {
                          break block220
                         }
                         $15 = $11 | ($10 << 12 | 0) | 0;
                         $1 = $1 + 3 | 0;
                         break block218;
                        }
                        $15 = $11 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($10 << 18 | 0) & 1835008 | 0) | 0;
                        $1 = $1 + 4 | 0;
                       }
                       block221 : {
                        if (($15 | 0) == (1114112 | 0)) {
                         break block221
                        }
                        if ($15 >>> 0 < 48 >>> 0) {
                         break block221
                        }
                        if ($15 >>> 0 < 58 >>> 0) {
                         continue label3
                        }
                       }
                       break label3;
                      };
                      if (($15 | 0) != (1114113 | 0)) {
                       break block216
                      }
                      $15 = 1114112;
                      if (($1 | 0) == ($6 | 0)) {
                       break block216
                      }
                      block222 : {
                       $15 = HEAP8[$1 >> 0] | 0;
                       if (($15 | 0) <= (-1 | 0)) {
                        break block222
                       }
                       $15 = $15 & 255 | 0;
                       break block216;
                      }
                      $6 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
                      $11 = $15 & 31 | 0;
                      block223 : {
                       if ($15 >>> 0 > -33 >>> 0) {
                        break block223
                       }
                       $15 = $11 << 6 | 0 | $6 | 0;
                       break block216;
                      }
                      $6 = $6 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                      block224 : {
                       if ($15 >>> 0 >= -16 >>> 0) {
                        break block224
                       }
                       $15 = $6 | ($11 << 12 | 0) | 0;
                       break block216;
                      }
                      $15 = $6 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($11 << 18 | 0) & 1835008 | 0) | 0;
                     }
                     $11 = ($15 | 0) == (1114112 | 0) ? 2 : 4;
                    }
                    _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($7 | 0, $9 | 0, 1 | 0);
                    $6 = $9;
                   }
                   block225 : {
                    $15 = HEAP32[($3 + 20 | 0) >> 2] | 0;
                    if (($15 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
                     break block225
                    }
                    _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
                   }
                   $1 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($15 << 4 | 0) | 0;
                   HEAP8[($1 + 12 | 0) >> 0] = $11;
                   HEAP32[($1 + 8 | 0) >> 2] = $9;
                   HEAP32[($1 + 4 | 0) >> 2] = $17;
                   HEAP32[$1 >> 2] = $6;
                   $7 = 0;
                   HEAP32[($3 + 32 | 0) >> 2] = 0;
                   HEAP32[($3 + 20 | 0) >> 2] = $15 + 1 | 0;
                   break block23;
                  }
                  block226 : {
                   if (($12 ^ -1 | 0) & ($1 | 0) != (46 | 0) | 0) {
                    break block226
                   }
                   block228 : {
                    block227 : {
                     $11 = $1 >>> 0 < 128 >>> 0;
                     if (!$11) {
                      break block227
                     }
                     $15 = 1;
                     break block228;
                    }
                    block229 : {
                     if ($1 >>> 0 >= 2048 >>> 0) {
                      break block229
                     }
                     $15 = 2;
                     break block228;
                    }
                    $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                   }
                   $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                   $7 = $6;
                   block230 : {
                    if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                     break block230
                    }
                    _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                    $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                   }
                   $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                   if ($11) {
                    break block231
                   }
                   $11 = $1 & 63 | 0 | -128 | 0;
                   $9 = $1 >>> 6 | 0;
                   block232 : {
                    if ($1 >>> 0 >= 2048 >>> 0) {
                     break block232
                    }
                    HEAP8[($7 + 1 | 0) >> 0] = $11;
                    HEAP8[$7 >> 0] = $9 | 192 | 0;
                    break block233;
                   }
                   $10 = $1 >>> 12 | 0;
                   $9 = $9 & 63 | 0 | -128 | 0;
                   block234 : {
                    if ($1 >>> 0 > 65535 >>> 0) {
                     break block234
                    }
                    HEAP8[($7 + 2 | 0) >> 0] = $11;
                    HEAP8[($7 + 1 | 0) >> 0] = $9;
                    HEAP8[$7 >> 0] = $10 | 224 | 0;
                    break block233;
                   }
                   HEAP8[($7 + 3 | 0) >> 0] = $11;
                   HEAP8[($7 + 2 | 0) >> 0] = $9;
                   HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                   HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                   break block233;
                  }
                  if ($13) {
                   break block24
                  }
                  block235 : {
                   if ($2 >>> 0 >= $6 >>> 0) {
                    break block235
                   }
                   if (!($10 | ($15 & 14 | 0 | 0) == (2 | 0) | 0)) {
                    break block38
                   }
                  }
                  $1 = 0;
                  $11 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                  if (($11 | 0) < (0 | 0)) {
                   break block236
                  }
                  $15 = HEAP32[($3 + 28 | 0) >> 2] | 0;
                  if ($11) {
                   break block237
                  }
                  $18 = 1;
                  if (!$11) {
                   break block238
                  }
                  wasm2js_memory_copy(1, $15, $11);
                  break block238;
                 }
                 block240 : {
                  block239 : {
                   $11 = $1 >>> 0 < 128 >>> 0;
                   if (!$11) {
                    break block239
                   }
                   $15 = 1;
                   break block240;
                  }
                  block241 : {
                   if ($1 >>> 0 >= 2048 >>> 0) {
                    break block241
                   }
                   $15 = 2;
                   break block240;
                  }
                  $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
                 }
                 $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                 $7 = $6;
                 block242 : {
                  if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
                   break block242
                  }
                  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
                  $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
                 }
                 $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
                 if ($11) {
                  break block243
                 }
                 $11 = $1 & 63 | 0 | -128 | 0;
                 $9 = $1 >>> 6 | 0;
                 block244 : {
                  if ($1 >>> 0 >= 2048 >>> 0) {
                   break block244
                  }
                  HEAP8[($7 + 1 | 0) >> 0] = $11;
                  HEAP8[$7 >> 0] = $9 | 192 | 0;
                  break block245;
                 }
                 $10 = $1 >>> 12 | 0;
                 $9 = $9 & 63 | 0 | -128 | 0;
                 block246 : {
                  if ($1 >>> 0 > 65535 >>> 0) {
                   break block246
                  }
                  HEAP8[($7 + 2 | 0) >> 0] = $11;
                  HEAP8[($7 + 1 | 0) >> 0] = $9;
                  HEAP8[$7 >> 0] = $10 | 224 | 0;
                  break block245;
                 }
                 HEAP8[($7 + 3 | 0) >> 0] = $11;
                 HEAP8[($7 + 2 | 0) >> 0] = $9;
                 HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
                 HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
                 break block245;
                }
                _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
                $1 = 1;
                $18 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($11 | 0, 1 | 0) | 0;
                if ($18) {
                 break block247
                }
                $18 = $11;
               }
               _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $18 | 0);
               wasm2js_trap();
              }
              block248 : {
               if (!$11) {
                break block248
               }
               wasm2js_memory_copy($18, $15, $11);
              }
              $9 = $11 & 1 | 0;
              $1 = 0;
              block249 : {
               if (($11 | 0) == (1 | 0)) {
                break block249
               }
               $7 = $11 & 2147483646 | 0;
               $1 = 0;
               label4 : while (1) {
                $15 = $18 + $1 | 0;
                $6 = HEAPU8[$15 >> 0] | 0;
                HEAP8[$15 >> 0] = ((($6 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $6 | 0;
                $15 = $15 + 1 | 0;
                $2140 = $15;
                $15 = HEAPU8[$15 >> 0] | 0;
                HEAP8[$2140 >> 0] = ((($15 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $15 | 0;
                $1 = $1 + 2 | 0;
                if (($7 | 0) != ($1 | 0)) {
                 continue label4
                }
                break label4;
               };
              }
              if (!$9) {
               break block238
              }
              $1 = $18 + $1 | 0;
              $2160 = $1;
              $1 = HEAPU8[$1 >> 0] | 0;
              HEAP8[$2160 >> 0] = ((($1 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $1 | 0;
             }
             block250 : {
              $15 = HEAP32[($3 + 20 | 0) >> 2] | 0;
              if (($15 | 0) != (HEAP32[($3 + 12 | 0) >> 2] | 0 | 0)) {
               break block250
              }
              _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($3 + 12 | 0 | 0);
             }
             $1 = (HEAP32[($3 + 16 | 0) >> 2] | 0) + ($15 << 4 | 0) | 0;
             HEAP8[($1 + 12 | 0) >> 0] = 4;
             HEAP32[($1 + 8 | 0) >> 2] = $11;
             HEAP32[($1 + 4 | 0) >> 2] = $18;
             HEAP32[$1 >> 2] = $11;
             $7 = 0;
             HEAP32[($3 + 32 | 0) >> 2] = 0;
             HEAP32[($3 + 20 | 0) >> 2] = $15 + 1 | 0;
             break block23;
            }
            $7 = 0;
            break block23;
           }
           HEAP8[$7 >> 0] = $1;
           break block233;
          }
          HEAP8[$7 >> 0] = $1;
         }
         HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
         $2 = $2 + 1 | 0;
         $7 = 3;
         break block23;
        }
        HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
       }
       $2 = $2 + 1 | 0;
       $7 = 2;
       break block23;
      }
      block252 : {
       block251 : {
        $11 = $1 >>> 0 < 128 >>> 0;
        if (!$11) {
         break block251
        }
        $15 = 1;
        break block252;
       }
       block253 : {
        if ($1 >>> 0 >= 2048 >>> 0) {
         break block253
        }
        $15 = 2;
        break block252;
       }
       $15 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
      }
      $6 = HEAP32[($3 + 32 | 0) >> 2] | 0;
      $7 = $6;
      block254 : {
       if ($15 >>> 0 <= ((HEAP32[($3 + 24 | 0) >> 2] | 0) - $7 | 0) >>> 0) {
        break block254
       }
       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 24 | 0 | 0, $7 | 0, $15 | 0, 1 | 0, 1 | 0);
       $7 = HEAP32[($3 + 32 | 0) >> 2] | 0;
      }
      $7 = (HEAP32[($3 + 28 | 0) >> 2] | 0) + $7 | 0;
      block257 : {
       block255 : {
        if ($11) {
         break block255
        }
        $11 = $1 & 63 | 0 | -128 | 0;
        $9 = $1 >>> 6 | 0;
        block256 : {
         if ($1 >>> 0 >= 2048 >>> 0) {
          break block256
         }
         HEAP8[($7 + 1 | 0) >> 0] = $11;
         HEAP8[$7 >> 0] = $9 | 192 | 0;
         break block257;
        }
        $10 = $1 >>> 12 | 0;
        $9 = $9 & 63 | 0 | -128 | 0;
        block258 : {
         if ($1 >>> 0 > 65535 >>> 0) {
          break block258
         }
         HEAP8[($7 + 2 | 0) >> 0] = $11;
         HEAP8[($7 + 1 | 0) >> 0] = $9;
         HEAP8[$7 >> 0] = $10 | 224 | 0;
         break block257;
        }
        HEAP8[($7 + 3 | 0) >> 0] = $11;
        HEAP8[($7 + 2 | 0) >> 0] = $9;
        HEAP8[($7 + 1 | 0) >> 0] = $10 & 63 | 0 | -128 | 0;
        HEAP8[$7 >> 0] = $1 >>> 18 | 0 | -16 | 0;
        break block257;
       }
       HEAP8[$7 >> 0] = $1;
      }
      HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
      $2 = $2 + 1 | 0;
      $7 = 8;
      break block23;
     }
     HEAP32[($3 + 32 | 0) >> 2] = $15 + $6 | 0;
    }
    $2 = $2 + 1 | 0;
    $7 = 4;
   }
   $6 = HEAP32[($3 + 8 | 0) >> 2] | 0;
   if ($2 >>> 0 <= $6 >>> 0) {
    continue label5
   }
   break label5;
  };
  i64toi32_i32$1 = $3;
  i64toi32_i32$2 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[($3 + 16 | 0) >> 2] | 0;
  $2298 = i64toi32_i32$2;
  i64toi32_i32$2 = $0;
  HEAP32[i64toi32_i32$2 >> 2] = $2298;
  HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] = HEAP32[(($3 + 12 | 0) + 8 | 0) >> 2] | 0;
  block259 : {
   $1 = HEAP32[($3 + 24 | 0) >> 2] | 0;
   if (!$1) {
    break block259
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($3 + 28 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
  }
  block260 : {
   $1 = HEAP32[$3 >> 2] | 0;
   if (!$1) {
    break block260
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($3 + 4 | 0) >> 2] | 0 | 0, $1 << 2 | 0 | 0, 4 | 0);
  }
  __stack_pointer = $3 + 96 | 0;
 }
 
 function _ZN88_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__ReverseSearcher$GT$15next_match_back17h2fa1a9c58682dc7fE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $2 = 0, $13 = 0, $8 = 0, $14 = 0, $6 = 0, $9 = 0, $3 = 0, $7 = 0, $10 = 0, $11 = 0, $12 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  $3 = 0;
  block : {
   $4 = HEAP32[($1 + 16 | 0) >> 2] | 0;
   $5 = HEAP32[($1 + 12 | 0) >> 2] | 0;
   if ($4 >>> 0 < $5 >>> 0) {
    break block
   }
   $6 = HEAP32[($1 + 8 | 0) >> 2] | 0;
   if ($4 >>> 0 > $6 >>> 0) {
    break block
   }
   $7 = $1 + 20 | 0;
   $8 = HEAPU8[($1 + 24 | 0) >> 0] | 0;
   $9 = $8 + -1 | 0;
   $10 = $7 + $9 | 0;
   $11 = HEAP32[($1 + 4 | 0) >> 2] | 0;
   $12 = $11 + $5 | 0;
   block5 : {
    block2 : {
     block1 : {
      if ($8 >>> 0 < 5 >>> 0) {
       break block1
      }
      label : while (1) {
       _ZN4core5slice6memchr7memrchr17ha19b96b88482c7b1E($2 + 8 | 0 | 0, HEAPU8[$10 >> 0] | 0 | 0, $12 | 0, $4 - $5 | 0 | 0);
       if (!((HEAP32[($2 + 8 | 0) >> 2] | 0) & 1 | 0)) {
        break block2
       }
       block3 : {
        $4 = (HEAP32[($2 + 12 | 0) >> 2] | 0) + $5 | 0;
        if ($4 >>> 0 < $9 >>> 0) {
         break block3
        }
        $13 = $4 - $9 | 0;
        $14 = $13 + $8 | 0;
        if ($14 >>> 0 < $13 >>> 0) {
         break block3
        }
        if ($14 >>> 0 > $6 >>> 0) {
         break block3
        }
        _ZN4core5slice5index16slice_index_fail17hd5820a8e667bb547E(0 | 0, $8 | 0, 4 | 0, 1049940 | 0);
        wasm2js_trap();
       }
       HEAP32[($1 + 16 | 0) >> 2] = $4;
       if ($4 >>> 0 < $5 >>> 0) {
        break block
       }
       if ($4 >>> 0 <= $6 >>> 0) {
        continue label
       }
       break block;
      };
     }
     label1 : while (1) {
      _ZN4core5slice6memchr7memrchr17ha19b96b88482c7b1E($2 | 0, HEAPU8[$10 >> 0] | 0 | 0, $12 | 0, $4 - $5 | 0 | 0);
      if (!((HEAP32[$2 >> 2] | 0) & 1 | 0)) {
       break block2
      }
      block4 : {
       $4 = (HEAP32[($2 + 4 | 0) >> 2] | 0) + $5 | 0;
       if ($4 >>> 0 < $9 >>> 0) {
        break block4
       }
       $13 = $4 - $9 | 0;
       $14 = $13 + $8 | 0;
       if ($14 >>> 0 < $13 >>> 0) {
        break block4
       }
       if ($14 >>> 0 > $6 >>> 0) {
        break block4
       }
       if (!(memcmp($11 + $13 | 0 | 0, $7 | 0, $8 | 0) | 0)) {
        break block5
       }
      }
      HEAP32[($1 + 16 | 0) >> 2] = $4;
      if ($4 >>> 0 < $5 >>> 0) {
       break block
      }
      if ($4 >>> 0 <= $6 >>> 0) {
       continue label1
      }
      break block;
     };
    }
    HEAP32[($1 + 16 | 0) >> 2] = $5;
    break block;
   }
   HEAP32[($0 + 8 | 0) >> 2] = $14;
   HEAP32[($0 + 4 | 0) >> 2] = $13;
   HEAP32[($1 + 16 | 0) >> 2] = $13;
   $3 = 1;
  }
  HEAP32[$0 >> 2] = $3;
  __stack_pointer = $2 + 16 | 0;
 }
 
 function _ZN51_$LT$i32$u20$as$u20$alloc__string__SpecToString$GT$14spec_to_string17h87b9cefa6d9a8d7dE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $4 = 0, $5 = 0, $6 = 0, i64toi32_i32$0 = 0, $3 = 0, i64toi32_i32$1 = 0, $68 = 0;
  $2 = __stack_pointer - 32 | 0;
  __stack_pointer = $2;
  _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
  block3 : {
   block1 : {
    block2 : {
     block : {
      if (($1 | 0) < (0 | 0)) {
       break block
      }
      $3 = 10;
      $4 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(10 | 0, 1 | 0) | 0;
      if (!$4) {
       break block1
      }
      $5 = 0;
      HEAP32[($2 + 28 | 0) >> 2] = 0;
      HEAP32[($2 + 24 | 0) >> 2] = $4;
      HEAP32[($2 + 20 | 0) >> 2] = 10;
      break block2;
     }
     $5 = 1;
     $3 = 11;
     $4 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(11 | 0, 1 | 0) | 0;
     if (!$4) {
      break block3
     }
     HEAP8[$4 >> 0] = 45;
     HEAP32[($2 + 24 | 0) >> 2] = $4;
     HEAP32[($2 + 20 | 0) >> 2] = 11;
     HEAP32[($2 + 28 | 0) >> 2] = 1;
    }
    $6 = $1 >> 31 | 0;
    _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$4_fmt17hfd251423c4523d9bE($2 | 0, ($1 ^ $6 | 0) - $6 | 0 | 0, $2 + 10 | 0 | 0, 10 | 0);
    $6 = HEAP32[$2 >> 2] | 0;
    block4 : {
     $1 = HEAP32[($2 + 4 | 0) >> 2] | 0;
     if ($1 >>> 0 <= ($3 - $5 | 0) >>> 0) {
      break block4
     }
     _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($2 + 20 | 0 | 0, $5 | 0, $1 | 0, 1 | 0, 1 | 0);
     $4 = HEAP32[($2 + 24 | 0) >> 2] | 0;
     $5 = HEAP32[($2 + 28 | 0) >> 2] | 0;
    }
    block5 : {
     if (!$1) {
      break block5
     }
     wasm2js_memory_copy($4 + $5 | 0, $6, $1);
    }
    HEAP32[($0 + 8 | 0) >> 2] = $5 + $1 | 0;
    i64toi32_i32$0 = HEAP32[($2 + 20 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[($2 + 24 | 0) >> 2] | 0;
    $68 = i64toi32_i32$0;
    i64toi32_i32$0 = $0;
    HEAP32[i64toi32_i32$0 >> 2] = $68;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    __stack_pointer = $2 + 32 | 0;
    return;
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 10 | 0);
   wasm2js_trap();
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 11 | 0);
  wasm2js_trap();
 }
 
 function _ZN16formula_ref_core21offset_formula_coords17h94159714e9552f4bE($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $15 = 0, $12 = 0, $16 = 0, $10 = 0, i64toi32_i32$0 = 0, $13 = 0, $17 = 0, $9 = 0, i64toi32_i32$1 = 0, $14 = 0, $22 = 0, $23 = 0, $6 = 0, $7 = 0, $11 = 0, $8 = 0, $18 = 0, $568 = 0;
  $5 = __stack_pointer - 80 | 0;
  __stack_pointer = $5;
  _ZN16formula_ref_core25parse_formula_into_tokens17hcc096630f88aa449E($5 + 16 | 0 | 0, $1 | 0, $2 | 0);
  HEAP32[($5 + 36 | 0) >> 2] = 0;
  i64toi32_i32$1 = $5;
  i64toi32_i32$0 = 1;
  HEAP32[($5 + 28 | 0) >> 2] = 0;
  HEAP32[($5 + 32 | 0) >> 2] = i64toi32_i32$0;
  $6 = HEAP32[($5 + 20 | 0) >> 2] | 0;
  $2 = HEAP32[($5 + 24 | 0) >> 2] | 0;
  $7 = $6 + ($2 << 4 | 0) | 0;
  $8 = HEAP32[($5 + 16 | 0) >> 2] | 0;
  $9 = $6;
  block48 : {
   block : {
    if (!$2) {
     break block
    }
    $10 = 1;
    $1 = 0;
    $2 = $9;
    label2 : while (1) {
     $9 = $2 + 16 | 0;
     $11 = HEAP32[$2 >> 2] | 0;
     if (($11 | 0) == (-2147483648 | 0)) {
      break block
     }
     $12 = HEAP32[($2 + 8 | 0) >> 2] | 0;
     $13 = HEAP32[($2 + 4 | 0) >> 2] | 0;
     block26 : {
      block6 : {
       block28 : {
        block19 : {
         block15 : {
          block17 : {
           block4 : {
            switch ((HEAPU8[($2 + 12 | 0) >> 0] | 0) + -2 | 0 | 0) {
            default:
             block5 : {
              if ($12 >>> 0 <= ((HEAP32[($5 + 28 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
               break block5
              }
              _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 28 | 0 | 0, $1 | 0, $12 | 0, 1 | 0, 1 | 0);
              $10 = HEAP32[($5 + 32 | 0) >> 2] | 0;
              $1 = HEAP32[($5 + 36 | 0) >> 2] | 0;
             }
             if (!$12) {
              break block6
             }
             wasm2js_memory_copy($10 + $1 | 0, $13, $12);
             break block6;
            case 0:
             $10 = $13 + $12 | 0;
             $14 = 0;
             $2 = $13;
             $15 = 0;
             label : while (1) {
              block12 : {
               block7 : {
                if (($2 | 0) == ($10 | 0)) {
                 break block7
                }
                block9 : {
                 block8 : {
                  $1 = HEAP8[$2 >> 0] | 0;
                  if (($1 | 0) <= (-1 | 0)) {
                   break block8
                  }
                  $2 = $2 + 1 | 0;
                  $1 = $1 & 255 | 0;
                  break block9;
                 }
                 $16 = (HEAPU8[($2 + 1 | 0) >> 0] | 0) & 63 | 0;
                 $17 = $1 & 31 | 0;
                 block10 : {
                  if ($1 >>> 0 > -33 >>> 0) {
                   break block10
                  }
                  $1 = $17 << 6 | 0 | $16 | 0;
                  $2 = $2 + 2 | 0;
                  break block9;
                 }
                 $16 = $16 << 6 | 0 | ((HEAPU8[($2 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                 block11 : {
                  if ($1 >>> 0 >= -16 >>> 0) {
                   break block11
                  }
                  $1 = $16 | ($17 << 12 | 0) | 0;
                  $2 = $2 + 3 | 0;
                  break block9;
                 }
                 $1 = $16 << 6 | 0 | ((HEAPU8[($2 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($17 << 18 | 0) & 1835008 | 0) | 0;
                 $2 = $2 + 4 | 0;
                }
                if (($1 | 0) == (36 | 0)) {
                 continue label
                }
                $16 = $1 + -48 | 0;
                if ($16 >>> 0 < 10 >>> 0) {
                 break block12
                }
                $16 = $1 + -97 | 0;
                block13 : {
                 if (($1 + -65 | 0) >>> 0 < 26 >>> 0) {
                  break block13
                 }
                 if ($16 >>> 0 >= 26 >>> 0) {
                  continue label
                 }
                }
                $15 = (($16 >>> 0 < 26 >>> 0 ? 31 : 63) & $1 | 0) + Math_imul($15, 26) | 0;
                continue label;
               }
               block14 : {
                if ($12) {
                 break block14
                }
                $12 = 0;
                HEAP32[($5 + 48 | 0) >> 2] = 0;
                i64toi32_i32$1 = $5;
                i64toi32_i32$0 = 1;
                HEAP32[($5 + 40 | 0) >> 2] = 0;
                HEAP32[($5 + 44 | 0) >> 2] = i64toi32_i32$0;
                break block15;
               }
               $2 = HEAPU8[$13 >> 0] | 0;
               block18 : {
                block16 : {
                 if ($12 >>> 0 > 7 >>> 0) {
                  break block16
                 }
                 if ((HEAPU8[$13 >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (1 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 1 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (2 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 2 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (3 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 3 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (4 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 4 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (5 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 5 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                  break block17
                 }
                 if (($12 | 0) == (6 | 0)) {
                  break block18
                 }
                 if ((HEAPU8[($13 + 6 | 0) >> 0] | 0 | 0) != (36 | 0)) {
                  break block18
                 }
                 break block17;
                }
                _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($5 + 8 | 0 | 0, 36 | 0, $13 | 0, $12 | 0);
                if ((HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) == (1 | 0)) {
                 break block17
                }
               }
               $12 = 0;
               HEAP32[($5 + 48 | 0) >> 2] = 0;
               i64toi32_i32$1 = $5;
               i64toi32_i32$0 = 1;
               HEAP32[($5 + 40 | 0) >> 2] = 0;
               HEAP32[($5 + 44 | 0) >> 2] = i64toi32_i32$0;
               if (($2 & 255 | 0 | 0) != (36 | 0)) {
                break block15
               }
               break block19;
              }
              $14 = $16 + Math_imul($14, 10) | 0;
              continue label;
             };
            case 1:
             $2 = $13;
             block20 : {
              if (($12 | 0) != (1 | 0)) {
               break block20
              }
              block22 : {
               block21 : {
                $15 = HEAPU8[$2 >> 0] | 0;
                $16 = $15 + -71 | 0;
                $2 = $16 & 255 | 0;
                if ($2 >>> 0 > 7 >>> 0) {
                 break block21
                }
                if ((225 >>> $2 | 0) & 1 | 0) {
                 break block22
                }
               }
               $2 = ($15 & 255 | 0 | 0) == (80 | 0) ? 1049919 : $13;
               $12 = 1;
               break block20;
              }
              $15 = ($16 << 2 | 0) & 1020 | 0;
              $2 = HEAP32[($15 + 1050048 | 0) >> 2] | 0;
              $12 = HEAP32[($15 + 1050016 | 0) >> 2] | 0;
             }
             block23 : {
              if ($12 >>> 0 <= ((HEAP32[($5 + 28 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
               break block23
              }
              _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 28 | 0 | 0, $1 | 0, $12 | 0, 1 | 0, 1 | 0);
              $10 = HEAP32[($5 + 32 | 0) >> 2] | 0;
              $1 = HEAP32[($5 + 36 | 0) >> 2] | 0;
             }
             if (!$12) {
              break block6
             }
             wasm2js_memory_copy($10 + $1 | 0, $2, $12);
             break block6;
            case 4:
             break block4;
            };
           }
           _ZN16formula_ref_core11emit_string17h9b42b7a63c63262dE($5 + 52 | 0 | 0, $13 | 0, $12 | 0);
           $15 = HEAP32[($5 + 56 | 0) >> 2] | 0;
           block24 : {
            $2 = HEAP32[($5 + 60 | 0) >> 2] | 0;
            if ($2 >>> 0 <= ((HEAP32[($5 + 28 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
             break block24
            }
            _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 28 | 0 | 0, $1 | 0, $2 | 0, 1 | 0, 1 | 0);
            $10 = HEAP32[($5 + 32 | 0) >> 2] | 0;
            $1 = HEAP32[($5 + 36 | 0) >> 2] | 0;
           }
           block25 : {
            if (!$2) {
             break block25
            }
            wasm2js_memory_copy($10 + $1 | 0, $15, $2);
           }
           $1 = $1 + $2 | 0;
           HEAP32[($5 + 36 | 0) >> 2] = $1;
           $2 = HEAP32[($5 + 52 | 0) >> 2] | 0;
           if (!$2) {
            break block26
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($15 | 0, $2 | 0, 1 | 0);
           break block26;
          }
          HEAP32[($5 + 68 | 0) >> 2] = $12;
          HEAP32[($5 + 64 | 0) >> 2] = 0;
          HEAP32[($5 + 60 | 0) >> 2] = $12;
          HEAP32[($5 + 56 | 0) >> 2] = $13;
          HEAP8[($5 + 76 | 0) >> 0] = 1;
          HEAP32[($5 + 52 | 0) >> 2] = 36;
          HEAP32[($5 + 72 | 0) >> 2] = 36;
          _ZN88_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__ReverseSearcher$GT$15next_match_back17h2fa1a9c58682dc7fE($5 + 40 | 0 | 0, $5 + 52 | 0 | 0);
          block27 : {
           if (!(HEAP32[($5 + 40 | 0) >> 2] | 0)) {
            break block27
           }
           $1 = HEAP32[($5 + 44 | 0) >> 2] | 0;
           i64toi32_i32$1 = $5;
           i64toi32_i32$0 = 1;
           HEAP32[($5 + 40 | 0) >> 2] = 0;
           HEAP32[($5 + 44 | 0) >> 2] = i64toi32_i32$0;
           HEAP32[($5 + 48 | 0) >> 2] = 0;
           $12 = ($1 | 0) != (0 | 0);
           if (($2 & 255 | 0 | 0) == (36 | 0)) {
            break block19
           }
           break block15;
          }
          $12 = 0;
          HEAP32[($5 + 48 | 0) >> 2] = 0;
          i64toi32_i32$1 = $5;
          i64toi32_i32$0 = 1;
          HEAP32[($5 + 40 | 0) >> 2] = 0;
          HEAP32[($5 + 44 | 0) >> 2] = i64toi32_i32$0;
          if (($2 & 255 | 0 | 0) == (36 | 0)) {
           break block19
          }
         }
         $15 = $15 + $3 | 0;
         $16 = 0;
         break block28;
        }
        $16 = 1;
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 40 | 0 | 0, 0 | 0, 1 | 0, 1 | 0, 1 | 0);
        HEAP8[((HEAP32[($5 + 44 | 0) >> 2] | 0) + (HEAP32[($5 + 48 | 0) >> 2] | 0) | 0) >> 0] = 36;
        HEAP32[($5 + 48 | 0) >> 2] = 1;
       }
       HEAP32[($5 + 60 | 0) >> 2] = 0;
       i64toi32_i32$1 = $5;
       i64toi32_i32$0 = 1;
       HEAP32[($5 + 52 | 0) >> 2] = 0;
       HEAP32[($5 + 56 | 0) >> 2] = i64toi32_i32$0;
       block32 : {
        block29 : {
         $18 = ($15 | 0) < (1 | 0);
         if ($18) {
          break block29
         }
         $16 = 1;
         $1 = -1;
         label1 : while (1) {
          $10 = $15 + -1 | 0;
          $15 = ($10 >>> 0) / (26 >>> 0) | 0;
          $17 = Math_imul($15, 26);
          block30 : {
           $2 = $1 + 1 | 0;
           if (($2 | 0) != (HEAP32[($5 + 52 | 0) >> 2] | 0 | 0)) {
            break block30
           }
           _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 52 | 0 | 0, $2 | 0, 1 | 0, 1 | 0, 1 | 0);
           $16 = HEAP32[($5 + 56 | 0) >> 2] | 0;
          }
          $17 = $10 - $17 | 0;
          block31 : {
           if (!$2) {
            break block31
           }
           wasm2js_memory_copy($16 + 1 | 0, $16, $2);
          }
          HEAP8[$16 >> 0] = $17 + 65 | 0;
          HEAP32[($5 + 60 | 0) >> 2] = $1 + 2 | 0;
          $1 = $2;
          if ($10 >>> 0 > 25 >>> 0) {
           continue label1
          }
          break label1;
         };
         $1 = $2 + 1 | 0;
         $17 = HEAP32[($5 + 56 | 0) >> 2] | 0;
         $15 = HEAP32[($5 + 52 | 0) >> 2] | 0;
         $16 = HEAP32[($5 + 48 | 0) >> 2] | 0;
         if ($2 >>> 0 < ((HEAP32[($5 + 40 | 0) >> 2] | 0) - $16 | 0) >>> 0) {
          break block32
         }
         _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 40 | 0 | 0, $16 | 0, $1 | 0, 1 | 0, 1 | 0);
         $16 = HEAP32[($5 + 48 | 0) >> 2] | 0;
         break block32;
        }
        $17 = 1;
        $15 = 0;
        $1 = 0;
       }
       $10 = HEAP32[($5 + 44 | 0) >> 2] | 0;
       block33 : {
        if (!$1) {
         break block33
        }
        wasm2js_memory_copy($10 + $16 | 0, $17, $1);
       }
       $2 = $16 + $1 | 0;
       HEAP32[($5 + 48 | 0) >> 2] = $2;
       block34 : {
        if (!$15) {
         break block34
        }
        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($17 | 0, $15 | 0, 1 | 0);
       }
       block37 : {
        block35 : {
         if (!$12) {
          break block35
         }
         $1 = $2;
         block36 : {
          if ((HEAP32[($5 + 40 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
           break block36
          }
          _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 40 | 0 | 0, $2 | 0, 1 | 0, 1 | 0, 1 | 0);
          $1 = HEAP32[($5 + 48 | 0) >> 2] | 0;
          $10 = HEAP32[($5 + 44 | 0) >> 2] | 0;
         }
         HEAP8[($10 + $1 | 0) >> 0] = 36;
         $2 = $2 + 1 | 0;
         HEAP32[($5 + 48 | 0) >> 2] = $2;
         break block37;
        }
        $14 = $14 + $4 | 0;
       }
       _ZN51_$LT$i32$u20$as$u20$alloc__string__SpecToString$GT$14spec_to_string17h87b9cefa6d9a8d7dE($5 + 52 | 0 | 0, $14 | 0);
       $15 = HEAP32[($5 + 56 | 0) >> 2] | 0;
       block38 : {
        $1 = HEAP32[($5 + 60 | 0) >> 2] | 0;
        if ($1 >>> 0 <= ((HEAP32[($5 + 40 | 0) >> 2] | 0) - $2 | 0) >>> 0) {
         break block38
        }
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 40 | 0 | 0, $2 | 0, $1 | 0, 1 | 0, 1 | 0);
        $10 = HEAP32[($5 + 44 | 0) >> 2] | 0;
        $2 = HEAP32[($5 + 48 | 0) >> 2] | 0;
       }
       block39 : {
        if (!$1) {
         break block39
        }
        wasm2js_memory_copy($10 + $2 | 0, $15, $1);
       }
       block40 : {
        $16 = HEAP32[($5 + 52 | 0) >> 2] | 0;
        if (!$16) {
         break block40
        }
        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($15 | 0, $16 | 0, 1 | 0);
       }
       block42 : {
        block41 : {
         if ($18) {
          break block41
         }
         if (($14 | 0) < (1 | 0)) {
          break block41
         }
         $2 = $2 + $1 | 0;
         $15 = $10;
         break block42;
        }
        _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
        block43 : {
         $15 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(5 | 0, 1 | 0) | 0;
         if (!$15) {
          break block43
         }
         HEAP8[($15 + 4 | 0) >> 0] = HEAPU8[(0 + 1049912 | 0) >> 0] | 0;
         $22 = 0;
         $23 = HEAPU8[($22 + 1049908 | 0) >> 0] | 0 | ((HEAPU8[($22 + 1049909 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($22 + 1049910 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($22 + 1049911 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
         HEAP8[$15 >> 0] = $23;
         HEAP8[($15 + 1 | 0) >> 0] = $23 >>> 8 | 0;
         HEAP8[($15 + 2 | 0) >> 0] = $23 >>> 16 | 0;
         HEAP8[($15 + 3 | 0) >> 0] = $23 >>> 24 | 0;
         block44 : {
          $2 = HEAP32[($5 + 40 | 0) >> 2] | 0;
          if (!$2) {
           break block44
          }
          _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($10 | 0, $2 | 0, 1 | 0);
         }
         $2 = 5;
         HEAP32[($5 + 40 | 0) >> 2] = 5;
         break block42;
        }
        _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, 5 | 0);
        wasm2js_trap();
       }
       block45 : {
        $1 = HEAP32[($5 + 36 | 0) >> 2] | 0;
        if ($2 >>> 0 <= ((HEAP32[($5 + 28 | 0) >> 2] | 0) - $1 | 0) >>> 0) {
         break block45
        }
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 28 | 0 | 0, $1 | 0, $2 | 0, 1 | 0, 1 | 0);
        $1 = HEAP32[($5 + 36 | 0) >> 2] | 0;
       }
       $10 = HEAP32[($5 + 32 | 0) >> 2] | 0;
       block46 : {
        if (!$2) {
         break block46
        }
        wasm2js_memory_copy($10 + $1 | 0, $15, $2);
       }
       $1 = $1 + $2 | 0;
       HEAP32[($5 + 36 | 0) >> 2] = $1;
       $2 = HEAP32[($5 + 40 | 0) >> 2] | 0;
       if (!$2) {
        break block26
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($15 | 0, $2 | 0, 1 | 0);
       break block26;
      }
      $1 = $1 + $12 | 0;
      HEAP32[($5 + 36 | 0) >> 2] = $1;
     }
     block47 : {
      if (!$11) {
       break block47
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($13 | 0, $11 | 0, 1 | 0);
     }
     $2 = $9;
     if (($2 | 0) != ($7 | 0)) {
      continue label2
     }
     break block48;
    };
   }
   if (($7 | 0) == ($9 | 0)) {
    break block48
   }
   $2 = ($7 - $9 | 0) >>> 4 | 0;
   label3 : while (1) {
    block49 : {
     $1 = HEAP32[$9 >> 2] | 0;
     if (!$1) {
      break block49
     }
     _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($9 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
    }
    $9 = $9 + 16 | 0;
    $2 = $2 + -1 | 0;
    if ($2) {
     continue label3
    }
    break label3;
   };
  }
  block50 : {
   if (!$8) {
    break block50
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($6 | 0, $8 << 4 | 0 | 0, 4 | 0);
  }
  i64toi32_i32$0 = HEAP32[($5 + 28 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($5 + 32 | 0) >> 2] | 0;
  $568 = i64toi32_i32$0;
  i64toi32_i32$0 = $0;
  HEAP32[i64toi32_i32$0 >> 2] = $568;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = HEAP32[(($5 + 28 | 0) + 8 | 0) >> 2] | 0;
  __stack_pointer = $5 + 80 | 0;
 }
 
 function _ZN16formula_ref_core22replace_formula_coords17h0844c26940be50d9E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $6 = 0, i64toi32_i32$2 = 0, i64toi32_i32$5 = 0, i64toi32_i32$1 = 0, $7 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, $19 = 0, $22 = 0, $20 = 0, $21 = 0, $23 = 0, $23$hi = 0, $18 = 0, $16 = 0, $11 = 0, $17 = 0, $8 = 0, $8$hi = 0, $9 = 0, $9$hi = 0, $12 = 0, $25 = 0, $10 = 0, $13 = 0, $62 = 0, $63 = 0, $14 = 0, $64 = 0, $24$hi = 0, $26 = 0, $26$hi = 0, $27 = 0, $65 = 0, $38 = 0, $49 = 0, $51 = 0, $75 = 0, $83 = 0, $88 = 0, $91 = 0, $112$hi = 0, $115$hi = 0, $118$hi = 0, $121$hi = 0, $15 = 0, $137 = 0, $334 = 0, $66 = 0, $24 = 0, $386 = 0, $386$hi = 0, $388$hi = 0, $417$hi = 0, $423 = 0, $423$hi = 0, $425$hi = 0, $772 = 0, $804 = 0, $876 = 0;
  $5 = __stack_pointer - 176 | 0;
  __stack_pointer = $5;
  block68 : {
   block2 : {
    block : {
     $6 = _ZN4core3ops8function6FnOnce9call_once17h7ef550448cb3efc3E_llvm_309696905035023971(0 | 0) | 0;
     if (!$6) {
      break block
     }
     $7 = $3 + Math_imul($4, 24) | 0;
     $38 = $6;
     i64toi32_i32$2 = $6;
     i64toi32_i32$0 = HEAP32[$6 >> 2] | 0;
     i64toi32_i32$1 = HEAP32[($6 + 4 | 0) >> 2] | 0;
     $8 = i64toi32_i32$0;
     $8$hi = i64toi32_i32$1;
     i64toi32_i32$2 = i64toi32_i32$0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$3 = 1;
     i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
     i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     i64toi32_i32$2 = $38;
     HEAP32[i64toi32_i32$2 >> 2] = i64toi32_i32$4;
     HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$5;
     i64toi32_i32$1 = $6;
     i64toi32_i32$5 = HEAP32[($6 + 8 | 0) >> 2] | 0;
     i64toi32_i32$2 = HEAP32[($6 + 12 | 0) >> 2] | 0;
     $9 = i64toi32_i32$5;
     $9$hi = i64toi32_i32$2;
     $6 = ($5 + 144 | 0) + 8 | 0;
     i64toi32_i32$1 = 0;
     i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 1050096 | 0) >> 2] | 0;
     i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 1050100 | 0) >> 2] | 0;
     $49 = i64toi32_i32$2;
     i64toi32_i32$2 = $6;
     HEAP32[$6 >> 2] = $49;
     HEAP32[($6 + 4 | 0) >> 2] = i64toi32_i32$5;
     i64toi32_i32$1 = 0;
     i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 1050088 | 0) >> 2] | 0;
     i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 1050092 | 0) >> 2] | 0;
     $51 = i64toi32_i32$5;
     i64toi32_i32$5 = $5;
     HEAP32[($5 + 144 | 0) >> 2] = $51;
     HEAP32[($5 + 148 | 0) >> 2] = i64toi32_i32$2;
     i64toi32_i32$2 = $9$hi;
     i64toi32_i32$5 = $5;
     HEAP32[($5 + 168 | 0) >> 2] = $9;
     HEAP32[($5 + 172 | 0) >> 2] = i64toi32_i32$2;
     i64toi32_i32$2 = $8$hi;
     i64toi32_i32$5 = $5;
     HEAP32[($5 + 160 | 0) >> 2] = $8;
     HEAP32[($5 + 164 | 0) >> 2] = i64toi32_i32$2;
     block1 : {
      if (!$4) {
       break block1
      }
      _ZN9hashbrown3raw21RawTable$LT$T$C$A$GT$14reserve_rehash17hcd63a91d9d868c85E($5 + 8 | 0 | 0, $5 + 144 | 0 | 0, $4 | 0, $5 + 160 | 0 | 0, 1 | 0);
     }
     _ZN102_$LT$core__iter__adapters__map__Map$LT$I$C$F$GT$$u20$as$u20$core__iter__traits__iterator__Iterator$GT$4fold17hb4bc216132771700E($3 | 0, $7 | 0, $5 + 144 | 0 | 0);
     i64toi32_i32$1 = ($5 + 144 | 0) + 24 | 0;
     i64toi32_i32$2 = HEAP32[i64toi32_i32$1 >> 2] | 0;
     i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] | 0;
     $75 = i64toi32_i32$2;
     i64toi32_i32$2 = ($5 + 16 | 0) + 24 | 0;
     HEAP32[i64toi32_i32$2 >> 2] = $75;
     HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$5;
     $10 = ($5 + 16 | 0) + 16 | 0;
     i64toi32_i32$1 = ($5 + 144 | 0) + 16 | 0;
     i64toi32_i32$5 = HEAP32[i64toi32_i32$1 >> 2] | 0;
     i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] | 0;
     $83 = i64toi32_i32$5;
     i64toi32_i32$5 = $10;
     HEAP32[i64toi32_i32$5 >> 2] = $83;
     HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$2;
     i64toi32_i32$1 = $6;
     i64toi32_i32$2 = HEAP32[$6 >> 2] | 0;
     i64toi32_i32$5 = HEAP32[($6 + 4 | 0) >> 2] | 0;
     $88 = i64toi32_i32$2;
     i64toi32_i32$2 = ($5 + 16 | 0) + 8 | 0;
     HEAP32[i64toi32_i32$2 >> 2] = $88;
     HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$5;
     i64toi32_i32$1 = $5;
     i64toi32_i32$5 = HEAP32[($5 + 144 | 0) >> 2] | 0;
     i64toi32_i32$2 = HEAP32[($5 + 148 | 0) >> 2] | 0;
     $91 = i64toi32_i32$5;
     i64toi32_i32$5 = $5;
     HEAP32[($5 + 16 | 0) >> 2] = $91;
     HEAP32[($5 + 20 | 0) >> 2] = i64toi32_i32$2;
     _ZN16formula_ref_core25parse_formula_into_tokens17hcc096630f88aa449E($5 + 48 | 0 | 0, $1 | 0, $2 | 0);
     HEAP32[($5 + 68 | 0) >> 2] = 0;
     i64toi32_i32$5 = $5;
     i64toi32_i32$2 = 1;
     HEAP32[($5 + 60 | 0) >> 2] = 0;
     HEAP32[($5 + 64 | 0) >> 2] = i64toi32_i32$2;
     $11 = HEAP32[($5 + 52 | 0) >> 2] | 0;
     $6 = HEAP32[($5 + 56 | 0) >> 2] | 0;
     $12 = $11 + ($6 << 4 | 0) | 0;
     $13 = HEAP32[($5 + 48 | 0) >> 2] | 0;
     $3 = $11;
     if (!$6) {
      break block2
     }
     i64toi32_i32$2 = 0;
     i64toi32_i32$1 = 3;
     i64toi32_i32$5 = 0;
     i64toi32_i32$3 = 32;
     i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
      $62 = 0;
     } else {
      i64toi32_i32$5 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$0 | 0) | 0;
      $62 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
     }
     $112$hi = i64toi32_i32$5;
     i64toi32_i32$5 = 0;
     $115$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $112$hi;
     i64toi32_i32$2 = $62;
     i64toi32_i32$1 = $115$hi;
     i64toi32_i32$3 = $5 + 124 | 0;
     i64toi32_i32$1 = i64toi32_i32$5 | i64toi32_i32$1 | 0;
     $8 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
     $8$hi = i64toi32_i32$1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$5 = 1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$3 = 32;
     i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
      $63 = 0;
     } else {
      i64toi32_i32$2 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$0 | 0) | 0;
      $63 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     }
     $118$hi = i64toi32_i32$2;
     i64toi32_i32$2 = 0;
     $121$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $118$hi;
     i64toi32_i32$1 = $63;
     i64toi32_i32$5 = $121$hi;
     i64toi32_i32$3 = $5 + 128 | 0;
     i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
     $9 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
     $9$hi = i64toi32_i32$5;
     $14 = ($5 + 72 | 0) + 4 | 0;
     $15 = $14 + 8 | 0;
     $4 = 0;
     $6 = $11;
     $16 = 0;
     label6 : while (1) {
      $3 = $6 + 16 | 0;
      $17 = HEAP32[$6 >> 2] | 0;
      if (($17 | 0) == (-2147483648 | 0)) {
       break block2
      }
      i64toi32_i32$2 = $6;
      i64toi32_i32$5 = HEAP32[($6 + 4 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[($6 + 8 | 0) >> 2] | 0;
      $137 = i64toi32_i32$5;
      i64toi32_i32$5 = $14;
      HEAP32[i64toi32_i32$5 >> 2] = $137;
      HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$1;
      HEAP32[$15 >> 2] = HEAP32[($6 + 12 | 0) >> 2] | 0;
      HEAP32[($5 + 72 | 0) >> 2] = $17;
      _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($5 + 88 | 0 | 0, $5 + 72 | 0 | 0);
      block3 : {
       $6 = HEAPU8[($5 + 84 | 0) >> 0] | 0;
       if (($6 | 0) != (3 | 0)) {
        break block3
       }
       $2 = HEAP32[($5 + 92 | 0) >> 2] | 0;
       block14 : {
        block13 : {
         block12 : {
          block6 : {
           block11 : {
            block7 : {
             block4 : {
              $6 = HEAP32[($5 + 96 | 0) >> 2] | 0;
              if (($6 | 0) != (1 | 0)) {
               break block4
              }
              $6 = 1;
              block5 : {
               $1 = HEAPU8[$2 >> 0] | 0;
               if (($1 | 0) != (33 | 0)) {
                break block5
               }
               $16 = 1;
               $7 = $2;
               break block6;
              }
              $16 = ($1 | 0) == (58 | 0) & $16 | 0;
              $7 = 1049915;
              $6 = 2;
              block10 : {
               switch ($1 + -71 | 0 | 0) {
               case 5:
                $7 = 1049913;
                break block6;
               case 6:
                $7 = 1049920;
                break block11;
               case 7:
                break block10;
               case 0:
                break block6;
               default:
                break block7;
               };
              }
              $7 = 1049917;
              break block6;
             }
             $1 = 0;
             if (($6 | 0) < (0 | 0)) {
              break block12
             }
             $16 = 0;
             if (!$6) {
              break block13
             }
             $7 = $2;
             break block6;
            }
            $7 = ($1 | 0) == (80 | 0) ? 1049919 : $2;
           }
           $6 = 1;
          }
          _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
          $1 = 1;
          $18 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($6 | 0, 1 | 0) | 0;
          if ($18) {
           break block14
          }
          $18 = $6;
         }
         _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $18 | 0);
         wasm2js_trap();
        }
        $18 = 1;
        $6 = 0;
        $7 = $2;
       }
       block15 : {
        if (!$6) {
         break block15
        }
        wasm2js_memory_copy($18, $7, $6);
       }
       block16 : {
        $1 = HEAP32[($5 + 88 | 0) >> 2] | 0;
        if (!$1) {
         break block16
        }
        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($2 | 0, $1 | 0, 1 | 0);
       }
       HEAP32[($5 + 96 | 0) >> 2] = $6;
       HEAP32[($5 + 92 | 0) >> 2] = $18;
       HEAP32[($5 + 88 | 0) >> 2] = $6;
       $6 = HEAPU8[($5 + 84 | 0) >> 0] | 0;
      }
      block18 : {
       block19 : {
        switch (($6 & 255 | 0) + -2 | 0 | 0) {
        case 0:
         $19 = HEAP32[($5 + 92 | 0) >> 2] | 0;
         $20 = HEAP32[($5 + 96 | 0) >> 2] | 0;
         $1 = $19 + $20 | 0;
         $21 = 0;
         $6 = $19;
         $2 = 0;
         block31 : {
          block49 : {
           block43 : {
            block48 : {
             block46 : {
              label : while (1) {
               block25 : {
                block20 : {
                 if (($6 | 0) == ($1 | 0)) {
                  break block20
                 }
                 block22 : {
                  block21 : {
                   $4 = HEAP8[$6 >> 0] | 0;
                   if (($4 | 0) <= (-1 | 0)) {
                    break block21
                   }
                   $6 = $6 + 1 | 0;
                   $4 = $4 & 255 | 0;
                   break block22;
                  }
                  $7 = (HEAPU8[($6 + 1 | 0) >> 0] | 0) & 63 | 0;
                  $22 = $4 & 31 | 0;
                  block23 : {
                   if ($4 >>> 0 > -33 >>> 0) {
                    break block23
                   }
                   $4 = $22 << 6 | 0 | $7 | 0;
                   $6 = $6 + 2 | 0;
                   break block22;
                  }
                  $7 = $7 << 6 | 0 | ((HEAPU8[($6 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                  block24 : {
                   if ($4 >>> 0 >= -16 >>> 0) {
                    break block24
                   }
                   $4 = $7 | ($22 << 12 | 0) | 0;
                   $6 = $6 + 3 | 0;
                   break block22;
                  }
                  $4 = $7 << 6 | 0 | ((HEAPU8[($6 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($22 << 18 | 0) & 1835008 | 0) | 0;
                  $6 = $6 + 4 | 0;
                 }
                 if (($4 | 0) == (36 | 0)) {
                  continue label
                 }
                 $7 = $4 + -48 | 0;
                 if ($7 >>> 0 < 10 >>> 0) {
                  break block25
                 }
                 $7 = $4 + -97 | 0;
                 block26 : {
                  if (($4 + -65 | 0) >>> 0 < 26 >>> 0) {
                   break block26
                  }
                  if ($7 >>> 0 >= 26 >>> 0) {
                   continue label
                  }
                 }
                 $2 = (($7 >>> 0 < 26 >>> 0 ? 31 : 63) & $4 | 0) + Math_imul($2, 26) | 0;
                 continue label;
                }
                HEAP32[($5 + 124 | 0) >> 2] = $21;
                HEAP32[($5 + 152 | 0) >> 2] = 0;
                i64toi32_i32$5 = $5;
                i64toi32_i32$1 = 1;
                HEAP32[($5 + 144 | 0) >> 2] = 0;
                HEAP32[($5 + 148 | 0) >> 2] = i64toi32_i32$1;
                block27 : {
                 if (($2 | 0) < (1 | 0)) {
                  break block27
                 }
                 $6 = 0;
                 $1 = 1;
                 label1 : while (1) {
                  $4 = $2 + -1 | 0;
                  $2 = ($4 >>> 0) / (26 >>> 0) | 0;
                  $7 = Math_imul($2, 26);
                  block28 : {
                   if (($6 | 0) != (HEAP32[($5 + 144 | 0) >> 2] | 0 | 0)) {
                    break block28
                   }
                   _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 144 | 0 | 0, $6 | 0, 1 | 0, 1 | 0, 1 | 0);
                   $1 = HEAP32[($5 + 148 | 0) >> 2] | 0;
                  }
                  $7 = $4 - $7 | 0;
                  block29 : {
                   if (!$6) {
                    break block29
                   }
                   wasm2js_memory_copy($1 + 1 | 0, $1, $6);
                  }
                  HEAP8[$1 >> 0] = $7 + 65 | 0;
                  $6 = $6 + 1 | 0;
                  HEAP32[($5 + 152 | 0) >> 2] = $6;
                  if ($4 >>> 0 > 25 >>> 0) {
                   continue label1
                  }
                  break label1;
                 };
                }
                HEAP32[(($5 + 128 | 0) + 8 | 0) >> 2] = HEAP32[(($5 + 144 | 0) + 8 | 0) >> 2] | 0;
                i64toi32_i32$2 = $5;
                i64toi32_i32$1 = HEAP32[($5 + 144 | 0) >> 2] | 0;
                i64toi32_i32$5 = HEAP32[($5 + 148 | 0) >> 2] | 0;
                $334 = i64toi32_i32$1;
                i64toi32_i32$1 = $5;
                HEAP32[($5 + 128 | 0) >> 2] = $334;
                HEAP32[($5 + 132 | 0) >> 2] = i64toi32_i32$5;
                i64toi32_i32$5 = $8$hi;
                i64toi32_i32$1 = $5;
                HEAP32[($5 + 152 | 0) >> 2] = $8;
                HEAP32[($5 + 156 | 0) >> 2] = i64toi32_i32$5;
                i64toi32_i32$5 = $9$hi;
                i64toi32_i32$1 = $5;
                HEAP32[($5 + 144 | 0) >> 2] = $9;
                HEAP32[($5 + 148 | 0) >> 2] = i64toi32_i32$5;
                _ZN5alloc3fmt6format12format_inner17h32c4432df66cb685E($5 + 100 | 0 | 0, 1048576 | 0, $5 + 144 | 0 | 0);
                block30 : {
                 $6 = HEAP32[($5 + 128 | 0) >> 2] | 0;
                 if (!$6) {
                  break block30
                 }
                 _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($5 + 132 | 0) >> 2] | 0 | 0, $6 | 0, 1 | 0);
                }
                if (($16 | !(HEAP32[($5 + 28 | 0) >> 2] | 0) | 0) & 1 | 0) {
                 break block31
                }
                i64toi32_i32$5 = _ZN4core4hash11BuildHasher8hash_one17hafe0ce79328045e6E($10 | 0, $5 + 100 | 0 | 0) | 0;
                i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
                $23 = i64toi32_i32$5;
                $23$hi = i64toi32_i32$1;
                $4 = HEAP32[($5 + 16 | 0) >> 2] | 0;
                $7 = $4 + -24 | 0;
                $1 = HEAP32[($5 + 20 | 0) >> 2] | 0;
                $6 = $1 & i64toi32_i32$5 | 0;
                i64toi32_i32$2 = i64toi32_i32$5;
                i64toi32_i32$5 = 0;
                i64toi32_i32$3 = 25;
                i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
                if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
                 i64toi32_i32$5 = 0;
                 $64 = i64toi32_i32$1 >>> i64toi32_i32$0 | 0;
                } else {
                 i64toi32_i32$5 = i64toi32_i32$1 >>> i64toi32_i32$0 | 0;
                 $64 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$0 | 0) | 0;
                }
                i64toi32_i32$1 = $64;
                i64toi32_i32$2 = 0;
                i64toi32_i32$3 = 127;
                i64toi32_i32$2 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
                $66 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
                i64toi32_i32$1 = 16843009;
                i64toi32_i32$1 = __wasm_i64_mul($66 | 0, i64toi32_i32$2 | 0, 16843009 | 0, i64toi32_i32$1 | 0) | 0;
                i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
                $24 = i64toi32_i32$1;
                $24$hi = i64toi32_i32$2;
                $25 = 0;
                $22 = HEAP32[($5 + 104 | 0) >> 2] | 0;
                $2 = HEAP32[($5 + 108 | 0) >> 2] | 0;
                block34 : {
                 label3 : while (1) {
                  block32 : {
                   i64toi32_i32$5 = $4 + $6 | 0;
                   i64toi32_i32$2 = HEAPU8[i64toi32_i32$5 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$5 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$5 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$5 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
                   i64toi32_i32$1 = HEAPU8[(i64toi32_i32$5 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$5 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$5 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$5 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
                   $26 = i64toi32_i32$2;
                   $26$hi = i64toi32_i32$1;
                   i64toi32_i32$1 = $24$hi;
                   i64toi32_i32$1 = $26$hi;
                   i64toi32_i32$5 = i64toi32_i32$2;
                   i64toi32_i32$2 = $24$hi;
                   i64toi32_i32$3 = $24;
                   i64toi32_i32$2 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
                   $23 = i64toi32_i32$5 ^ i64toi32_i32$3 | 0;
                   $23$hi = i64toi32_i32$2;
                   i64toi32_i32$1 = $23;
                   i64toi32_i32$5 = -1;
                   i64toi32_i32$3 = -1;
                   i64toi32_i32$5 = i64toi32_i32$2 ^ i64toi32_i32$5 | 0;
                   $386 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
                   $386$hi = i64toi32_i32$5;
                   i64toi32_i32$5 = i64toi32_i32$2;
                   i64toi32_i32$5 = i64toi32_i32$2;
                   i64toi32_i32$2 = i64toi32_i32$1;
                   i64toi32_i32$1 = -16843010;
                   i64toi32_i32$3 = -16843009;
                   i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
                   i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$1 | 0;
                   if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
                    i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
                   }
                   $388$hi = i64toi32_i32$4;
                   i64toi32_i32$4 = $386$hi;
                   i64toi32_i32$5 = $386;
                   i64toi32_i32$2 = $388$hi;
                   i64toi32_i32$3 = i64toi32_i32$0;
                   i64toi32_i32$2 = i64toi32_i32$4 & i64toi32_i32$2 | 0;
                   i64toi32_i32$4 = i64toi32_i32$5 & i64toi32_i32$0 | 0;
                   i64toi32_i32$5 = -2139062144;
                   i64toi32_i32$3 = -2139062144;
                   i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
                   $23 = i64toi32_i32$4 & i64toi32_i32$3 | 0;
                   $23$hi = i64toi32_i32$5;
                   if (!($23 | i64toi32_i32$5 | 0)) {
                    break block32
                   }
                   label2 : while (1) {
                    block33 : {
                     i64toi32_i32$5 = $23$hi;
                     i64toi32_i32$5 = __wasm_ctz_i64($23 | 0, i64toi32_i32$5 | 0) | 0;
                     i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
                     $21 = Math_imul(0 - (((i64toi32_i32$5 >>> 3 | 0) + $6 | 0) & $1 | 0) | 0, 24);
                     $27 = $7 + $21 | 0;
                     if (($2 | 0) != (HEAP32[($27 + 8 | 0) >> 2] | 0 | 0)) {
                      break block33
                     }
                     if (!(memcmp($22 | 0, HEAP32[($27 + 4 | 0) >> 2] | 0 | 0, $2 | 0) | 0)) {
                      break block34
                     }
                    }
                    i64toi32_i32$4 = $23$hi;
                    i64toi32_i32$2 = $23;
                    i64toi32_i32$5 = -1;
                    i64toi32_i32$3 = -1;
                    i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
                    i64toi32_i32$0 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
                    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
                     i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
                    }
                    $417$hi = i64toi32_i32$0;
                    i64toi32_i32$0 = $23$hi;
                    i64toi32_i32$0 = $417$hi;
                    i64toi32_i32$4 = i64toi32_i32$1;
                    i64toi32_i32$2 = $23$hi;
                    i64toi32_i32$3 = $23;
                    i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$2 | 0;
                    $23 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
                    $23$hi = i64toi32_i32$2;
                    if (!!($23 | i64toi32_i32$2 | 0)) {
                     continue label2
                    }
                    break label2;
                   };
                  }
                  i64toi32_i32$2 = $26$hi;
                  $423 = $26;
                  $423$hi = i64toi32_i32$2;
                  i64toi32_i32$0 = $26;
                  i64toi32_i32$4 = 0;
                  i64toi32_i32$3 = 1;
                  i64toi32_i32$5 = i64toi32_i32$3 & 31 | 0;
                  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
                   i64toi32_i32$4 = i64toi32_i32$0 << i64toi32_i32$5 | 0;
                   $65 = 0;
                  } else {
                   i64toi32_i32$4 = ((1 << i64toi32_i32$5 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$5 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$5 | 0) | 0;
                   $65 = i64toi32_i32$0 << i64toi32_i32$5 | 0;
                  }
                  $425$hi = i64toi32_i32$4;
                  i64toi32_i32$4 = $423$hi;
                  i64toi32_i32$2 = $423;
                  i64toi32_i32$0 = $425$hi;
                  i64toi32_i32$3 = $65;
                  i64toi32_i32$0 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
                  i64toi32_i32$4 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
                  i64toi32_i32$2 = -2139062144;
                  i64toi32_i32$3 = -2139062144;
                  i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$2 | 0;
                  if (!!(i64toi32_i32$4 & i64toi32_i32$3 | 0 | i64toi32_i32$2 | 0)) {
                   break block31
                  }
                  $25 = $25 + 8 | 0;
                  $6 = ($6 + $25 | 0) & $1 | 0;
                  continue label3;
                 };
                }
                $4 = $4 + $21 | 0;
                $6 = HEAP32[($4 + -8 | 0) >> 2] | 0;
                $2 = $6 + (HEAP32[($4 + -4 | 0) >> 2] | 0) | 0;
                $21 = 0;
                $1 = 0;
                label4 : while (1) {
                 block40 : {
                  block35 : {
                   if (($6 | 0) == ($2 | 0)) {
                    break block35
                   }
                   block37 : {
                    block36 : {
                     $4 = HEAP8[$6 >> 0] | 0;
                     if (($4 | 0) <= (-1 | 0)) {
                      break block36
                     }
                     $6 = $6 + 1 | 0;
                     $4 = $4 & 255 | 0;
                     break block37;
                    }
                    $7 = (HEAPU8[($6 + 1 | 0) >> 0] | 0) & 63 | 0;
                    $22 = $4 & 31 | 0;
                    block38 : {
                     if ($4 >>> 0 > -33 >>> 0) {
                      break block38
                     }
                     $4 = $22 << 6 | 0 | $7 | 0;
                     $6 = $6 + 2 | 0;
                     break block37;
                    }
                    $7 = $7 << 6 | 0 | ((HEAPU8[($6 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
                    block39 : {
                     if ($4 >>> 0 >= -16 >>> 0) {
                      break block39
                     }
                     $4 = $7 | ($22 << 12 | 0) | 0;
                     $6 = $6 + 3 | 0;
                     break block37;
                    }
                    $4 = $7 << 6 | 0 | ((HEAPU8[($6 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($22 << 18 | 0) & 1835008 | 0) | 0;
                    $6 = $6 + 4 | 0;
                   }
                   if (($4 | 0) == (36 | 0)) {
                    continue label4
                   }
                   $7 = $4 + -48 | 0;
                   if ($7 >>> 0 < 10 >>> 0) {
                    break block40
                   }
                   $7 = $4 + -97 | 0;
                   block41 : {
                    if (($4 + -65 | 0) >>> 0 < 26 >>> 0) {
                     break block41
                    }
                    if ($7 >>> 0 >= 26 >>> 0) {
                     continue label4
                    }
                   }
                   $1 = (($7 >>> 0 < 26 >>> 0 ? 31 : 63) & $4 | 0) + Math_imul($1, 26) | 0;
                   continue label4;
                  }
                  block42 : {
                   if ($20) {
                    break block42
                   }
                   i64toi32_i32$4 = $5;
                   i64toi32_i32$2 = 1;
                   HEAP32[($5 + 112 | 0) >> 2] = 0;
                   HEAP32[($5 + 116 | 0) >> 2] = i64toi32_i32$2;
                   $4 = 0;
                   $6 = 0;
                   break block43;
                  }
                  $2 = HEAPU8[$19 >> 0] | 0;
                  block45 : {
                   block44 : {
                    if ($20 >>> 0 > 7 >>> 0) {
                     break block44
                    }
                    if ((HEAPU8[$19 >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (1 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 1 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (2 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 2 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (3 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 3 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (4 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 4 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (5 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 5 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    if (($20 | 0) == (6 | 0)) {
                     break block46
                    }
                    if ((HEAPU8[($19 + 6 | 0) >> 0] | 0 | 0) == (36 | 0)) {
                     break block45
                    }
                    break block46;
                   }
                   _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($5 | 0, 36 | 0, $19 | 0, $20 | 0);
                   if ((HEAP32[$5 >> 2] | 0 | 0) != (1 | 0)) {
                    break block46
                   }
                  }
                  HEAP32[($5 + 160 | 0) >> 2] = $20;
                  HEAP32[($5 + 156 | 0) >> 2] = 0;
                  HEAP32[($5 + 152 | 0) >> 2] = $20;
                  HEAP32[($5 + 148 | 0) >> 2] = $19;
                  HEAP8[($5 + 168 | 0) >> 0] = 1;
                  HEAP32[($5 + 144 | 0) >> 2] = 36;
                  HEAP32[($5 + 164 | 0) >> 2] = 36;
                  _ZN88_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__ReverseSearcher$GT$15next_match_back17h2fa1a9c58682dc7fE($5 + 128 | 0 | 0, $5 + 144 | 0 | 0);
                  block47 : {
                   if (!(HEAP32[($5 + 128 | 0) >> 2] | 0)) {
                    break block47
                   }
                   $4 = 0;
                   HEAP32[($5 + 120 | 0) >> 2] = 0;
                   i64toi32_i32$4 = $5;
                   i64toi32_i32$2 = 1;
                   HEAP32[($5 + 112 | 0) >> 2] = 0;
                   HEAP32[($5 + 116 | 0) >> 2] = i64toi32_i32$2;
                   $19 = (HEAP32[($5 + 132 | 0) >> 2] | 0 | 0) != (0 | 0);
                   $6 = $19;
                   if (($2 & 255 | 0 | 0) == (36 | 0)) {
                    break block48
                   }
                   break block49;
                  }
                  $4 = 0;
                  HEAP32[($5 + 120 | 0) >> 2] = 0;
                  i64toi32_i32$4 = $5;
                  i64toi32_i32$2 = 1;
                  HEAP32[($5 + 112 | 0) >> 2] = 0;
                  HEAP32[($5 + 116 | 0) >> 2] = i64toi32_i32$2;
                  $19 = 0;
                  $6 = 0;
                  if (($2 & 255 | 0 | 0) != (36 | 0)) {
                   break block49
                  }
                  break block48;
                 }
                 $21 = $7 + Math_imul($21, 10) | 0;
                 continue label4;
                };
               }
               $21 = $7 + Math_imul($21, 10) | 0;
               continue label;
              };
             }
             $4 = 0;
             HEAP32[($5 + 120 | 0) >> 2] = 0;
             i64toi32_i32$4 = $5;
             i64toi32_i32$2 = 1;
             HEAP32[($5 + 112 | 0) >> 2] = 0;
             HEAP32[($5 + 116 | 0) >> 2] = i64toi32_i32$2;
             $19 = 0;
             $6 = 0;
             if (($2 & 255 | 0 | 0) != (36 | 0)) {
              break block49
             }
            }
            $4 = 1;
            _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 112 | 0 | 0, 0 | 0, 1 | 0, 1 | 0, 1 | 0);
            HEAP8[((HEAP32[($5 + 116 | 0) >> 2] | 0) + (HEAP32[($5 + 120 | 0) >> 2] | 0) | 0) >> 0] = 36;
           }
           HEAP32[($5 + 120 | 0) >> 2] = $4;
           $19 = $6;
          }
          HEAP32[($5 + 152 | 0) >> 2] = 0;
          i64toi32_i32$4 = $5;
          i64toi32_i32$2 = 1;
          HEAP32[($5 + 144 | 0) >> 2] = 0;
          HEAP32[($5 + 148 | 0) >> 2] = i64toi32_i32$2;
          block53 : {
           block50 : {
            if (($1 | 0) < (1 | 0)) {
             break block50
            }
            $7 = 1;
            $4 = -1;
            label5 : while (1) {
             $2 = $1 + -1 | 0;
             $1 = ($2 >>> 0) / (26 >>> 0) | 0;
             $22 = Math_imul($1, 26);
             block51 : {
              $6 = $4 + 1 | 0;
              if (($6 | 0) != (HEAP32[($5 + 144 | 0) >> 2] | 0 | 0)) {
               break block51
              }
              _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 144 | 0 | 0, $6 | 0, 1 | 0, 1 | 0, 1 | 0);
              $7 = HEAP32[($5 + 148 | 0) >> 2] | 0;
             }
             $22 = $2 - $22 | 0;
             block52 : {
              if (!$6) {
               break block52
              }
              wasm2js_memory_copy($7 + 1 | 0, $7, $6);
             }
             HEAP8[$7 >> 0] = $22 + 65 | 0;
             HEAP32[($5 + 152 | 0) >> 2] = $4 + 2 | 0;
             $4 = $6;
             if ($2 >>> 0 > 25 >>> 0) {
              continue label5
             }
             break label5;
            };
            $2 = $6 + 1 | 0;
            $22 = HEAP32[($5 + 148 | 0) >> 2] | 0;
            $1 = HEAP32[($5 + 144 | 0) >> 2] | 0;
            $4 = HEAP32[($5 + 120 | 0) >> 2] | 0;
            if ($6 >>> 0 < ((HEAP32[($5 + 112 | 0) >> 2] | 0) - $4 | 0) >>> 0) {
             break block53
            }
            _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 112 | 0 | 0, $4 | 0, $2 | 0, 1 | 0, 1 | 0);
            $4 = HEAP32[($5 + 120 | 0) >> 2] | 0;
            break block53;
           }
           $22 = 1;
           $1 = 0;
           $2 = 0;
          }
          $7 = HEAP32[($5 + 116 | 0) >> 2] | 0;
          block54 : {
           if (!$2) {
            break block54
           }
           wasm2js_memory_copy($7 + $4 | 0, $22, $2);
          }
          $6 = $4 + $2 | 0;
          HEAP32[($5 + 120 | 0) >> 2] = $6;
          block55 : {
           if (!$1) {
            break block55
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($22 | 0, $1 | 0, 1 | 0);
          }
          $2 = HEAP32[($5 + 112 | 0) >> 2] | 0;
          block56 : {
           if (!$19) {
            break block56
           }
           $4 = $6;
           block57 : {
            if (($2 | 0) != ($6 | 0)) {
             break block57
            }
            _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 112 | 0 | 0, $6 | 0, 1 | 0, 1 | 0, 1 | 0);
            $2 = HEAP32[($5 + 112 | 0) >> 2] | 0;
            $4 = HEAP32[($5 + 120 | 0) >> 2] | 0;
            $7 = HEAP32[($5 + 116 | 0) >> 2] | 0;
           }
           HEAP8[($7 + $4 | 0) >> 0] = 36;
           $6 = $6 + 1 | 0;
           HEAP32[($5 + 120 | 0) >> 2] = $6;
          }
          _ZN51_$LT$i32$u20$as$u20$alloc__string__SpecToString$GT$14spec_to_string17h87b9cefa6d9a8d7dE($5 + 144 | 0 | 0, $21 | 0);
          $1 = HEAP32[($5 + 148 | 0) >> 2] | 0;
          block58 : {
           $4 = HEAP32[($5 + 152 | 0) >> 2] | 0;
           if ($4 >>> 0 <= ($2 - $6 | 0) >>> 0) {
            break block58
           }
           _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 112 | 0 | 0, $6 | 0, $4 | 0, 1 | 0, 1 | 0);
           $7 = HEAP32[($5 + 116 | 0) >> 2] | 0;
           $6 = HEAP32[($5 + 120 | 0) >> 2] | 0;
          }
          block59 : {
           if (!$4) {
            break block59
           }
           wasm2js_memory_copy($7 + $6 | 0, $1, $4);
          }
          HEAP32[($5 + 120 | 0) >> 2] = $6 + $4 | 0;
          block60 : {
           $6 = HEAP32[($5 + 144 | 0) >> 2] | 0;
           if (!$6) {
            break block60
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($1 | 0, $6 | 0, 1 | 0);
          }
          block61 : {
           $6 = HEAP32[($5 + 88 | 0) >> 2] | 0;
           if (!$6) {
            break block61
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($5 + 92 | 0) >> 2] | 0 | 0, $6 | 0, 1 | 0);
          }
          HEAP32[(($5 + 88 | 0) + 8 | 0) >> 2] = HEAP32[(($5 + 112 | 0) + 8 | 0) >> 2] | 0;
          i64toi32_i32$0 = $5;
          i64toi32_i32$2 = HEAP32[($5 + 112 | 0) >> 2] | 0;
          i64toi32_i32$4 = HEAP32[($5 + 116 | 0) >> 2] | 0;
          $772 = i64toi32_i32$2;
          i64toi32_i32$2 = $5;
          HEAP32[($5 + 88 | 0) >> 2] = $772;
          HEAP32[($5 + 92 | 0) >> 2] = i64toi32_i32$4;
         }
         block62 : {
          $6 = HEAP32[($5 + 100 | 0) >> 2] | 0;
          if (!$6) {
           break block62
          }
          _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($5 + 104 | 0) >> 2] | 0 | 0, $6 | 0, 1 | 0);
         }
         $4 = HEAP32[($5 + 68 | 0) >> 2] | 0;
         break block18;
        case 4:
         break block19;
        default:
         break block18;
        };
       }
       _ZN16formula_ref_core11emit_string17h9b42b7a63c63262dE($5 + 144 | 0 | 0, HEAP32[($5 + 76 | 0) >> 2] | 0 | 0, HEAP32[($5 + 80 | 0) >> 2] | 0 | 0);
       block63 : {
        $6 = HEAP32[($5 + 88 | 0) >> 2] | 0;
        if (!$6) {
         break block63
        }
        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($5 + 92 | 0) >> 2] | 0 | 0, $6 | 0, 1 | 0);
       }
       HEAP32[(($5 + 88 | 0) + 8 | 0) >> 2] = HEAP32[(($5 + 144 | 0) + 8 | 0) >> 2] | 0;
       i64toi32_i32$0 = $5;
       i64toi32_i32$4 = HEAP32[($5 + 144 | 0) >> 2] | 0;
       i64toi32_i32$2 = HEAP32[($5 + 148 | 0) >> 2] | 0;
       $804 = i64toi32_i32$4;
       i64toi32_i32$4 = $5;
       HEAP32[($5 + 88 | 0) >> 2] = $804;
       HEAP32[($5 + 92 | 0) >> 2] = i64toi32_i32$2;
      }
      $2 = HEAP32[($5 + 92 | 0) >> 2] | 0;
      block64 : {
       $6 = HEAP32[($5 + 96 | 0) >> 2] | 0;
       if ($6 >>> 0 <= ((HEAP32[($5 + 60 | 0) >> 2] | 0) - $4 | 0) >>> 0) {
        break block64
       }
       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($5 + 60 | 0 | 0, $4 | 0, $6 | 0, 1 | 0, 1 | 0);
       $4 = HEAP32[($5 + 68 | 0) >> 2] | 0;
      }
      block65 : {
       if (!$6) {
        break block65
       }
       wasm2js_memory_copy((HEAP32[($5 + 64 | 0) >> 2] | 0) + $4 | 0, $2, $6);
      }
      $4 = $4 + $6 | 0;
      HEAP32[($5 + 68 | 0) >> 2] = $4;
      block66 : {
       $6 = HEAP32[($5 + 88 | 0) >> 2] | 0;
       if (!$6) {
        break block66
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($2 | 0, $6 | 0, 1 | 0);
      }
      block67 : {
       if (!$17) {
        break block67
       }
       _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($5 + 76 | 0) >> 2] | 0 | 0, $17 | 0, 1 | 0);
      }
      $6 = $3;
      if (($6 | 0) != ($12 | 0)) {
       continue label6
      }
      break block68;
     };
    }
    _ZN3std6thread5local18panic_access_error17h244585fb6eab2b51E(1050348 | 0);
    wasm2js_trap();
   }
   if (($12 | 0) == ($3 | 0)) {
    break block68
   }
   $6 = ($12 - $3 | 0) >>> 4 | 0;
   label7 : while (1) {
    block69 : {
     $4 = HEAP32[$3 >> 2] | 0;
     if (!$4) {
      break block69
     }
     _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($3 + 4 | 0) >> 2] | 0 | 0, $4 | 0, 1 | 0);
    }
    $3 = $3 + 16 | 0;
    $6 = $6 + -1 | 0;
    if ($6) {
     continue label7
    }
    break label7;
   };
  }
  block70 : {
   if (!$13) {
    break block70
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($11 | 0, $13 << 4 | 0 | 0, 4 | 0);
  }
  i64toi32_i32$0 = $5;
  i64toi32_i32$2 = HEAP32[($5 + 60 | 0) >> 2] | 0;
  i64toi32_i32$4 = HEAP32[($5 + 64 | 0) >> 2] | 0;
  $876 = i64toi32_i32$2;
  i64toi32_i32$2 = $0;
  HEAP32[i64toi32_i32$2 >> 2] = $876;
  HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$4;
  HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] = HEAP32[(($5 + 60 | 0) + 8 | 0) >> 2] | 0;
  _ZN79_$LT$hashbrown__raw__RawTable$LT$T$C$A$GT$$u20$as$u20$core__ops__drop__Drop$GT$4drop17h3067237d7422f34eE($5 + 16 | 0 | 0);
  __stack_pointer = $5 + 176 | 0;
 }
 
 function _ZN4core3ops8function6FnOnce9call_once17ha557fb8d14849720E($0) {
  $0 = $0 | 0;
  HEAP32[($0 + 12 | 0) >> 2] = 0;
  HEAP32[($0 + 4 | 0) >> 2] = 0;
  HEAP32[($0 + 8 | 0) >> 2] = 1;
  HEAP8[$0 >> 0] = 0;
 }
 
 function formula_ref_alloc($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0, $26 = 0;
  $1 = 0;
  block : {
   if (($0 | 0) < (0 | 0)) {
    break block
   }
   block1 : {
    if ($0) {
     break block1
    }
    return 1 | 0;
   }
   _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
   $1 = 1;
   $2 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($0 | 0, 1 | 0) | 0;
   if (!$2) {
    break block
   }
   $1 = $2;
   block2 : {
    if (($0 | 0) == (1 | 0)) {
     break block2
    }
    block3 : {
     $0 = $0 + -1 | 0;
     if (!$0) {
      break block3
     }
     wasm2js_memory_fill($2, 0, $0);
    }
    $1 = $2 + $0 | 0;
   }
   HEAP8[$1 >> 0] = 0;
   return $2 | 0;
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $0 | 0);
  wasm2js_trap();
 }
 
 function formula_ref_dealloc($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if (!$0) {
    break block
   }
   if (!$1) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($0 | 0, $1 | 0, 1 | 0);
  }
 }
 
 function formula_ref_result_len() {
  var $0 = 0, $1 = 0;
  $0 = __stack_pointer - 16 | 0;
  __stack_pointer = $0;
  block : {
   if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
    break block
   }
   HEAP32[($0 + 4 | 0) >> 2] = 1051816;
   HEAP32[($0 + 8 | 0) >> 2] = $0 + 4 | 0;
   _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $0 + 8 | 0 | 0, 1049892 | 0);
  }
  $1 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
  HEAP8[(0 + 1051816 | 0) >> 0] = 1;
  HEAP8[($0 + 15 | 0) >> 0] = $1;
  block1 : {
   if (($1 | 0) != (1 | 0)) {
    break block1
   }
   _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $0 + 15 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
   wasm2js_trap();
  }
  HEAP8[(0 + 1051816 | 0) >> 0] = 0;
  $1 = HEAP32[(0 + 1051828 | 0) >> 2] | 0;
  __stack_pointer = $0 + 16 | 0;
  return $1 | 0;
 }
 
 function formula_ref_result_ptr() {
  var $0 = 0, $1 = 0;
  $0 = __stack_pointer - 16 | 0;
  __stack_pointer = $0;
  block : {
   if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
    break block
   }
   HEAP32[($0 + 4 | 0) >> 2] = 1051816;
   HEAP32[($0 + 8 | 0) >> 2] = $0 + 4 | 0;
   _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $0 + 8 | 0 | 0, 1049892 | 0);
  }
  $1 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
  HEAP8[(0 + 1051816 | 0) >> 0] = 1;
  HEAP8[($0 + 15 | 0) >> 0] = $1;
  block1 : {
   if (($1 | 0) != (1 | 0)) {
    break block1
   }
   _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $0 + 15 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
   wasm2js_trap();
  }
  HEAP8[(0 + 1051816 | 0) >> 0] = 0;
  $1 = HEAP32[(0 + 1051824 | 0) >> 2] | 0;
  __stack_pointer = $0 + 16 | 0;
  return $1 | 0;
 }
 
 function formula_ref_rewrite($0, $1, $2, $3, $4, $5, $6, $7, $8) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  $6 = $6 | 0;
  $7 = $7 | 0;
  $8 = $8 | 0;
  var $9 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $10 = 0, $11 = 0, $42 = 0, $45 = 0, $48 = 0, $77 = 0, $83 = 0, $364 = 0, $370 = 0, $418 = 0;
  $9 = __stack_pointer - 128 | 0;
  __stack_pointer = $9;
  _ZN4core3str8converts9from_utf817h82c888a988db5c6bE($9 + 48 | 0 | 0, $1 | 0, $2 | 0);
  block38 : {
   block4 : {
    block12 : {
     block13 : {
      block2 : {
       block : {
        if ((HEAP32[($9 + 48 | 0) >> 2] | 0 | 0) != (1 | 0)) {
         break block
        }
        block1 : {
         if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
          break block1
         }
         HEAP32[($9 + 88 | 0) >> 2] = 1051816;
         HEAP32[($9 + 100 | 0) >> 2] = $9 + 88 | 0;
         _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $9 + 100 | 0 | 0, 1049892 | 0);
        }
        $2 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
        HEAP8[(0 + 1051816 | 0) >> 0] = 1;
        HEAP8[($9 + 100 | 0) >> 0] = $2;
        if (($2 | 0) == (1 | 0)) {
         break block2
        }
        HEAP32[(0 + 1051828 | 0) >> 2] = 0;
        $2 = 0;
        block3 : {
         if ((HEAP32[(0 + 1051820 | 0) >> 2] | 0) >>> 0 > 20 >>> 0) {
          break block3
         }
         _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE(1051820 | 0, 0 | 0, 21 | 0, 1 | 0, 1 | 0);
         $2 = HEAP32[(0 + 1051828 | 0) >> 2] | 0;
        }
        $1 = (HEAP32[(0 + 1051824 | 0) >> 2] | 0) + $2 | 0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1049993 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049994 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049995 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049996 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1049997 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049998 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049999 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 105e4 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $42 = i64toi32_i32$0;
        i64toi32_i32$0 = $1;
        $23 = $42;
        HEAP8[$1 >> 0] = $23;
        HEAP8[($1 + 1 | 0) >> 0] = $23 >>> 8 | 0;
        HEAP8[($1 + 2 | 0) >> 0] = $23 >>> 16 | 0;
        HEAP8[($1 + 3 | 0) >> 0] = $23 >>> 24 | 0;
        HEAP8[($1 + 4 | 0) >> 0] = i64toi32_i32$1;
        HEAP8[($1 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
        HEAP8[($1 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
        HEAP8[($1 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1050001 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050002 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050003 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050004 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1050005 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050006 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050007 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050008 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $45 = i64toi32_i32$1;
        i64toi32_i32$1 = $1 + 8 | 0;
        $24 = $45;
        HEAP8[i64toi32_i32$1 >> 0] = $24;
        HEAP8[(i64toi32_i32$1 + 1 | 0) >> 0] = $24 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 2 | 0) >> 0] = $24 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 3 | 0) >> 0] = $24 >>> 24 | 0;
        HEAP8[(i64toi32_i32$1 + 4 | 0) >> 0] = i64toi32_i32$0;
        HEAP8[(i64toi32_i32$1 + 5 | 0) >> 0] = i64toi32_i32$0 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 6 | 0) >> 0] = i64toi32_i32$0 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 7 | 0) >> 0] = i64toi32_i32$0 >>> 24 | 0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1050006 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050007 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050008 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050009 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1050010 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050011 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050012 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1050013 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $48 = i64toi32_i32$0;
        i64toi32_i32$0 = $1 + 13 | 0;
        $25 = $48;
        HEAP8[i64toi32_i32$0 >> 0] = $25;
        HEAP8[(i64toi32_i32$0 + 1 | 0) >> 0] = $25 >>> 8 | 0;
        HEAP8[(i64toi32_i32$0 + 2 | 0) >> 0] = $25 >>> 16 | 0;
        HEAP8[(i64toi32_i32$0 + 3 | 0) >> 0] = $25 >>> 24 | 0;
        HEAP8[(i64toi32_i32$0 + 4 | 0) >> 0] = i64toi32_i32$1;
        HEAP8[(i64toi32_i32$0 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
        HEAP8[(i64toi32_i32$0 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
        HEAP8[(i64toi32_i32$0 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
        HEAP32[(0 + 1051828 | 0) >> 2] = $2 + 21 | 0;
        HEAP8[(0 + 1051816 | 0) >> 0] = 0;
        $2 = 1;
        break block4;
       }
       $10 = HEAP32[($9 + 56 | 0) >> 2] | 0;
       $11 = HEAP32[($9 + 52 | 0) >> 2] | 0;
       block10 : {
        block7 : {
         switch ($0 + -1 | 0 | 0) {
         default:
          block9 : {
           if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
            break block9
           }
           HEAP32[($9 + 100 | 0) >> 2] = 1051816;
           HEAP32[($9 + 48 | 0) >> 2] = $9 + 100 | 0;
           _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $9 + 48 | 0 | 0, 1049892 | 0);
          }
          $2 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
          HEAP8[(0 + 1051816 | 0) >> 0] = 1;
          HEAP8[($9 + 48 | 0) >> 0] = $2;
          if (($2 | 0) == (1 | 0)) {
           break block10
          }
          HEAP32[(0 + 1051828 | 0) >> 2] = 0;
          $2 = 0;
          block11 : {
           if ((HEAP32[(0 + 1051820 | 0) >> 2] | 0) >>> 0 > 19 >>> 0) {
            break block11
           }
           _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE(1051820 | 0, 0 | 0, 20 | 0, 1 | 0, 1 | 0);
           $2 = HEAP32[(0 + 1051828 | 0) >> 2] | 0;
          }
          $2 = (HEAP32[(0 + 1051824 | 0) >> 2] | 0) + $2 | 0;
          i64toi32_i32$2 = 0;
          i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1049973 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049974 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049975 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049976 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1049977 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049978 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049979 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049980 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          $77 = i64toi32_i32$1;
          i64toi32_i32$1 = $2;
          $26 = $77;
          HEAP8[$2 >> 0] = $26;
          HEAP8[($2 + 1 | 0) >> 0] = $26 >>> 8 | 0;
          HEAP8[($2 + 2 | 0) >> 0] = $26 >>> 16 | 0;
          HEAP8[($2 + 3 | 0) >> 0] = $26 >>> 24 | 0;
          HEAP8[($2 + 4 | 0) >> 0] = i64toi32_i32$0;
          HEAP8[($2 + 5 | 0) >> 0] = i64toi32_i32$0 >>> 8 | 0;
          HEAP8[($2 + 6 | 0) >> 0] = i64toi32_i32$0 >>> 16 | 0;
          HEAP8[($2 + 7 | 0) >> 0] = i64toi32_i32$0 >>> 24 | 0;
          $27 = 0;
          $28 = $2 + 16 | 0;
          $29 = HEAPU8[($27 + 1049989 | 0) >> 0] | 0 | ((HEAPU8[($27 + 1049990 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($27 + 1049991 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($27 + 1049992 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          HEAP8[$28 >> 0] = $29;
          HEAP8[($28 + 1 | 0) >> 0] = $29 >>> 8 | 0;
          HEAP8[($28 + 2 | 0) >> 0] = $29 >>> 16 | 0;
          HEAP8[($28 + 3 | 0) >> 0] = $29 >>> 24 | 0;
          i64toi32_i32$2 = 0;
          i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1049981 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049982 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049983 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049984 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1049985 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049986 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049987 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049988 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          $83 = i64toi32_i32$0;
          i64toi32_i32$0 = $2 + 8 | 0;
          $30 = $83;
          HEAP8[i64toi32_i32$0 >> 0] = $30;
          HEAP8[(i64toi32_i32$0 + 1 | 0) >> 0] = $30 >>> 8 | 0;
          HEAP8[(i64toi32_i32$0 + 2 | 0) >> 0] = $30 >>> 16 | 0;
          HEAP8[(i64toi32_i32$0 + 3 | 0) >> 0] = $30 >>> 24 | 0;
          HEAP8[(i64toi32_i32$0 + 4 | 0) >> 0] = i64toi32_i32$1;
          HEAP8[(i64toi32_i32$0 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
          HEAP8[(i64toi32_i32$0 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
          HEAP8[(i64toi32_i32$0 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
          HEAP32[(0 + 1051828 | 0) >> 2] = (HEAP32[(0 + 1051828 | 0) >> 2] | 0) + 20 | 0;
          HEAP8[(0 + 1051816 | 0) >> 0] = 0;
          $2 = 3;
          break block4;
         case 1:
          _ZN16formula_ref_core21adjust_formula_coords17h8ad8ddbe53204ac4E($9 + 24 | 0 | 0, $11 | 0, $10 | 0, $3 | 0, $4 | 0, $5 | 0, $6 | 0);
          break block12;
         case 0:
          _ZN16formula_ref_core21offset_formula_coords17h94159714e9552f4bE($9 + 24 | 0 | 0, $11 | 0, $10 | 0, $3 | 0, $4 | 0);
          break block12;
         case 2:
          break block7;
         };
        }
        _ZN4core3str8converts9from_utf817h82c888a988db5c6bE($9 + 48 | 0 | 0, $7 | 0, $8 | 0);
        if (HEAP32[($9 + 48 | 0) >> 2] | 0) {
         break block13
        }
        $1 = HEAP32[($9 + 52 | 0) >> 2] | 0;
        $2 = HEAP32[($9 + 56 | 0) >> 2] | 0;
        HEAP32[($9 + 44 | 0) >> 2] = 0;
        i64toi32_i32$0 = $9;
        i64toi32_i32$1 = 4;
        HEAP32[($9 + 36 | 0) >> 2] = 0;
        HEAP32[($9 + 40 | 0) >> 2] = i64toi32_i32$1;
        HEAP16[($9 + 84 | 0) >> 1] = 0;
        HEAP32[($9 + 80 | 0) >> 2] = $2;
        HEAP32[($9 + 76 | 0) >> 2] = 0;
        HEAP8[($9 + 72 | 0) >> 0] = 1;
        HEAP32[($9 + 68 | 0) >> 2] = 10;
        HEAP32[($9 + 64 | 0) >> 2] = $2;
        HEAP32[($9 + 60 | 0) >> 2] = 0;
        HEAP32[($9 + 56 | 0) >> 2] = $2;
        HEAP32[($9 + 52 | 0) >> 2] = $1;
        HEAP32[($9 + 48 | 0) >> 2] = 10;
        block16 : {
         label : while (1) {
          $2 = HEAP32[($9 + 52 | 0) >> 2] | 0;
          _ZN81_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__Searcher$GT$10next_match17h123487cfc1cd2b98E($9 + 100 | 0 | 0, $9 + 48 | 0 | 0);
          block15 : {
           block14 : {
            if ((HEAP32[($9 + 100 | 0) >> 2] | 0 | 0) != (1 | 0)) {
             break block14
            }
            $1 = HEAP32[($9 + 76 | 0) >> 2] | 0;
            $4 = HEAP32[($9 + 108 | 0) >> 2] | 0;
            HEAP32[($9 + 76 | 0) >> 2] = $4;
            $0 = $2 + $1 | 0;
            $2 = $4 - $1 | 0;
            break block15;
           }
           if (HEAPU8[($9 + 85 | 0) >> 0] | 0) {
            break block16
           }
           HEAP8[($9 + 85 | 0) >> 0] = 1;
           block18 : {
            block17 : {
             if ((HEAPU8[($9 + 84 | 0) >> 0] | 0 | 0) != (1 | 0)) {
              break block17
             }
             $1 = HEAP32[($9 + 80 | 0) >> 2] | 0;
             $2 = HEAP32[($9 + 76 | 0) >> 2] | 0;
             break block18;
            }
            $1 = HEAP32[($9 + 80 | 0) >> 2] | 0;
            $2 = HEAP32[($9 + 76 | 0) >> 2] | 0;
            if (($1 | 0) == ($2 | 0)) {
             break block16
            }
           }
           $0 = (HEAP32[($9 + 52 | 0) >> 2] | 0) + $2 | 0;
           $2 = $1 - $2 | 0;
          }
          block20 : {
           block19 : {
            if ($2) {
             break block19
            }
            $1 = $2;
            break block20;
           }
           $1 = $2;
           $4 = $0 + $2 | 0;
           if ((HEAPU8[($4 + -1 | 0) >> 0] | 0 | 0) != (10 | 0)) {
            break block20
           }
           $1 = $2 + -1 | 0;
           if (!$1) {
            break block20
           }
           if ((HEAPU8[($4 + -2 | 0) >> 0] | 0 | 0) != (13 | 0)) {
            break block20
           }
           $1 = $2 + -2 | 0;
          }
          block21 : {
           if (!$1) {
            break block21
           }
           HEAP32[($9 + 116 | 0) >> 2] = $1;
           HEAP32[($9 + 112 | 0) >> 2] = 0;
           HEAP32[($9 + 108 | 0) >> 2] = $1;
           HEAP32[($9 + 104 | 0) >> 2] = $0;
           HEAP8[($9 + 124 | 0) >> 0] = 1;
           HEAP32[($9 + 100 | 0) >> 2] = 61;
           HEAP32[($9 + 120 | 0) >> 2] = 61;
           _ZN81_$LT$core__str__pattern__CharSearcher$u20$as$u20$core__str__pattern__Searcher$GT$10next_match17h123487cfc1cd2b98E($9 + 88 | 0 | 0, $9 + 100 | 0 | 0);
           if (!(HEAP32[($9 + 88 | 0) >> 2] | 0)) {
            break block21
           }
           if (!$0) {
            break block21
           }
           $4 = HEAP32[($9 + 96 | 0) >> 2] | 0;
           _ZN4core3str21_$LT$impl$u20$str$GT$12trim_matches17hb28bc8dcbb172ecfE($9 + 16 | 0 | 0, $0 | 0, HEAP32[($9 + 92 | 0) >> 2] | 0 | 0);
           $7 = 0;
           block24 : {
            block22 : {
             $2 = HEAP32[($9 + 20 | 0) >> 2] | 0;
             if (($2 | 0) < (0 | 0)) {
              break block22
             }
             $6 = HEAP32[($9 + 16 | 0) >> 2] | 0;
             block23 : {
              if ($2) {
               break block23
              }
              $3 = 1;
              break block24;
             }
             _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
             $7 = 1;
             $3 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($2 | 0, 1 | 0) | 0;
             if ($3) {
              break block24
             }
             $3 = $2;
            }
            _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($7 | 0, $3 | 0);
            wasm2js_trap();
           }
           $0 = $0 + $4 | 0;
           $1 = $1 - $4 | 0;
           block25 : {
            if (!$2) {
             break block25
            }
            wasm2js_memory_copy($3, $6, $2);
           }
           _ZN4core3str21_$LT$impl$u20$str$GT$12trim_matches17hb28bc8dcbb172ecfE($9 + 8 | 0 | 0, $0 | 0, $1 | 0);
           $0 = 0;
           block28 : {
            block26 : {
             $1 = HEAP32[($9 + 12 | 0) >> 2] | 0;
             if (($1 | 0) < (0 | 0)) {
              break block26
             }
             $4 = HEAP32[($9 + 8 | 0) >> 2] | 0;
             block27 : {
              if ($1) {
               break block27
              }
              $8 = 1;
              break block28;
             }
             _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
             $0 = 1;
             $8 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($1 | 0, 1 | 0) | 0;
             if ($8) {
              break block28
             }
             $8 = $1;
            }
            _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($0 | 0, $8 | 0);
            wasm2js_trap();
           }
           block29 : {
            if (!$1) {
             break block29
            }
            wasm2js_memory_copy($8, $4, $1);
           }
           block30 : {
            $4 = HEAP32[($9 + 44 | 0) >> 2] | 0;
            if (($4 | 0) != (HEAP32[($9 + 36 | 0) >> 2] | 0 | 0)) {
             break block30
            }
            _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17h6e3bf38268bccdbaE($9 + 36 | 0 | 0);
           }
           $0 = (HEAP32[($9 + 40 | 0) >> 2] | 0) + Math_imul($4, 24) | 0;
           HEAP32[($0 + 20 | 0) >> 2] = $1;
           HEAP32[($0 + 16 | 0) >> 2] = $8;
           HEAP32[($0 + 12 | 0) >> 2] = $1;
           HEAP32[($0 + 8 | 0) >> 2] = $2;
           HEAP32[($0 + 4 | 0) >> 2] = $3;
           HEAP32[$0 >> 2] = $2;
           HEAP32[($9 + 44 | 0) >> 2] = $4 + 1 | 0;
          }
          if (!(HEAPU8[($9 + 85 | 0) >> 0] | 0)) {
           continue label
          }
          break label;
         };
        }
        _ZN16formula_ref_core22replace_formula_coords17h0844c26940be50d9E($9 + 24 | 0 | 0, $11 | 0, $10 | 0, HEAP32[($9 + 40 | 0) >> 2] | 0 | 0, HEAP32[($9 + 44 | 0) >> 2] | 0 | 0);
        block31 : {
         $1 = HEAP32[($9 + 44 | 0) >> 2] | 0;
         if (!$1) {
          break block31
         }
         $2 = HEAP32[($9 + 40 | 0) >> 2] | 0;
         label1 : while (1) {
          block32 : {
           $0 = HEAP32[$2 >> 2] | 0;
           if (!$0) {
            break block32
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($2 + 4 | 0) >> 2] | 0 | 0, $0 | 0, 1 | 0);
          }
          block33 : {
           $0 = HEAP32[($2 + 12 | 0) >> 2] | 0;
           if (!$0) {
            break block33
           }
           _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($2 + 16 | 0) >> 2] | 0 | 0, $0 | 0, 1 | 0);
          }
          $2 = $2 + 24 | 0;
          $1 = $1 + -1 | 0;
          if ($1) {
           continue label1
          }
          break label1;
         };
        }
        $2 = HEAP32[($9 + 36 | 0) >> 2] | 0;
        if (!$2) {
         break block12
        }
        _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($9 + 40 | 0) >> 2] | 0 | 0, Math_imul($2, 24) | 0, 4 | 0);
        break block12;
       }
       _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $9 + 48 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
       wasm2js_trap();
      }
      _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $9 + 100 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
      wasm2js_trap();
     }
     block34 : {
      if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
       break block34
      }
      HEAP32[($9 + 88 | 0) >> 2] = 1051816;
      HEAP32[($9 + 100 | 0) >> 2] = $9 + 88 | 0;
      _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $9 + 100 | 0 | 0, 1049892 | 0);
     }
     $2 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
     HEAP8[(0 + 1051816 | 0) >> 0] = 1;
     HEAP8[($9 + 100 | 0) >> 0] = $2;
     block35 : {
      if (($2 | 0) == (1 | 0)) {
       break block35
      }
      HEAP32[(0 + 1051828 | 0) >> 2] = 0;
      $2 = 0;
      block36 : {
       if ((HEAP32[(0 + 1051820 | 0) >> 2] | 0) >>> 0 > 16 >>> 0) {
        break block36
       }
       _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE(1051820 | 0, 0 | 0, 17 | 0, 1 | 0, 1 | 0);
       $2 = HEAP32[(0 + 1051828 | 0) >> 2] | 0;
      }
      $2 = (HEAP32[(0 + 1051824 | 0) >> 2] | 0) + $2 | 0;
      i64toi32_i32$2 = 0;
      i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1049956 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049957 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049958 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049959 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
      i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1049960 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049961 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049962 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049963 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
      $364 = i64toi32_i32$1;
      i64toi32_i32$1 = $2;
      $31 = $364;
      HEAP8[$2 >> 0] = $31;
      HEAP8[($2 + 1 | 0) >> 0] = $31 >>> 8 | 0;
      HEAP8[($2 + 2 | 0) >> 0] = $31 >>> 16 | 0;
      HEAP8[($2 + 3 | 0) >> 0] = $31 >>> 24 | 0;
      HEAP8[($2 + 4 | 0) >> 0] = i64toi32_i32$0;
      HEAP8[($2 + 5 | 0) >> 0] = i64toi32_i32$0 >>> 8 | 0;
      HEAP8[($2 + 6 | 0) >> 0] = i64toi32_i32$0 >>> 16 | 0;
      HEAP8[($2 + 7 | 0) >> 0] = i64toi32_i32$0 >>> 24 | 0;
      HEAP8[($2 + 16 | 0) >> 0] = HEAPU8[(0 + 1049972 | 0) >> 0] | 0;
      i64toi32_i32$2 = 0;
      i64toi32_i32$0 = HEAPU8[(i64toi32_i32$2 + 1049964 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049965 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049966 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049967 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
      i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 1049968 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049969 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049970 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 1049971 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
      $370 = i64toi32_i32$0;
      i64toi32_i32$0 = $2 + 8 | 0;
      $32 = $370;
      HEAP8[i64toi32_i32$0 >> 0] = $32;
      HEAP8[(i64toi32_i32$0 + 1 | 0) >> 0] = $32 >>> 8 | 0;
      HEAP8[(i64toi32_i32$0 + 2 | 0) >> 0] = $32 >>> 16 | 0;
      HEAP8[(i64toi32_i32$0 + 3 | 0) >> 0] = $32 >>> 24 | 0;
      HEAP8[(i64toi32_i32$0 + 4 | 0) >> 0] = i64toi32_i32$1;
      HEAP8[(i64toi32_i32$0 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
      HEAP8[(i64toi32_i32$0 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
      HEAP8[(i64toi32_i32$0 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
      HEAP32[(0 + 1051828 | 0) >> 2] = (HEAP32[(0 + 1051828 | 0) >> 2] | 0) + 17 | 0;
      HEAP8[(0 + 1051816 | 0) >> 0] = 0;
      $2 = 2;
      break block4;
     }
     _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $9 + 100 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
     wasm2js_trap();
    }
    $2 = HEAP32[($9 + 32 | 0) >> 2] | 0;
    $0 = HEAP32[($9 + 28 | 0) >> 2] | 0;
    block37 : {
     if ((HEAPU8[(0 + 1051832 | 0) >> 0] | 0 | 0) == (3 | 0)) {
      break block37
     }
     HEAP32[($9 + 100 | 0) >> 2] = 1051816;
     HEAP32[($9 + 48 | 0) >> 2] = $9 + 100 | 0;
     _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E(1051832 | 0, 1 | 0, $9 + 48 | 0 | 0, 1049892 | 0);
    }
    $1 = HEAPU8[(0 + 1051816 | 0) >> 0] | 0;
    HEAP8[(0 + 1051816 | 0) >> 0] = 1;
    HEAP8[($9 + 48 | 0) >> 0] = $1;
    if (($1 | 0) == (1 | 0)) {
     break block38
    }
    HEAP32[(0 + 1051828 | 0) >> 2] = 0;
    $1 = 0;
    block39 : {
     if ($2 >>> 0 <= (HEAP32[(0 + 1051820 | 0) >> 2] | 0) >>> 0) {
      break block39
     }
     _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE(1051820 | 0, 0 | 0, $2 | 0, 1 | 0, 1 | 0);
     $1 = HEAP32[(0 + 1051828 | 0) >> 2] | 0;
    }
    block40 : {
     if (!$2) {
      break block40
     }
     wasm2js_memory_copy((HEAP32[(0 + 1051824 | 0) >> 2] | 0) + $1 | 0, $0, $2);
    }
    HEAP32[(0 + 1051828 | 0) >> 2] = (HEAP32[(0 + 1051828 | 0) >> 2] | 0) + $2 | 0;
    HEAP8[(0 + 1051816 | 0) >> 0] = 0;
    block41 : {
     $2 = HEAP32[($9 + 24 | 0) >> 2] | 0;
     if (!$2) {
      break block41
     }
     _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($0 | 0, $2 | 0, 1 | 0);
    }
    $2 = 0;
   }
   __stack_pointer = $9 + 128 | 0;
   return $2 | 0;
  }
  _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E(0 | 0, $9 + 48 | 0 | 0, 1049890 | 0, 1050104 | 0, 65 | 0, 1050136 | 0);
  wasm2js_trap();
 }
 
 function _ZN102_$LT$core__iter__adapters__map__Map$LT$I$C$F$GT$$u20$as$u20$core__iter__traits__iterator__Iterator$GT$4fold17hb4bc216132771700E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $8 = 0, $10 = 0, $9 = 0, $6 = 0, $7 = 0, $5 = 0, $13 = 0, $4 = 0, $11 = 0, $12 = 0, $67 = 0, $87 = 0, i64toi32_i32$1 = 0;
  $3 = __stack_pointer - 48 | 0;
  __stack_pointer = $3;
  block2 : {
   block : {
    if (($0 | 0) == ($1 | 0)) {
     break block
    }
    $4 = (($1 - $0 | 0) >>> 0) / (24 >>> 0) | 0;
    $5 = $3 + 12 | 0;
    $6 = 0;
    label1 : while (1) {
     block1 : {
      $7 = $0 + Math_imul($6, 24) | 0;
      $8 = HEAP32[($7 + 8 | 0) >> 2] | 0;
      if (($8 | 0) >= (0 | 0)) {
       break block1
      }
      $1 = 0;
      break block2;
     }
     block4 : {
      block3 : {
       if ($8) {
        break block3
       }
       $9 = 1;
       break block4;
      }
      $10 = HEAP32[($7 + 4 | 0) >> 2] | 0;
      _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
      $1 = 1;
      $9 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($8 | 0, 1 | 0) | 0;
      if (!$9) {
       break block2
      }
      block5 : {
       if (!$8) {
        break block5
       }
       wasm2js_memory_copy($9, $10, $8);
      }
      $11 = $8 & 1 | 0;
      $1 = 0;
      block6 : {
       if (($8 | 0) == (1 | 0)) {
        break block6
       }
       $12 = $8 & 2147483646 | 0;
       $1 = 0;
       label : while (1) {
        $10 = $9 + $1 | 0;
        $13 = HEAPU8[$10 >> 0] | 0;
        HEAP8[$10 >> 0] = ((($13 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $13 | 0;
        $10 = $10 + 1 | 0;
        $67 = $10;
        $10 = HEAPU8[$10 >> 0] | 0;
        HEAP8[$67 >> 0] = ((($10 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $10 | 0;
        $1 = $1 + 2 | 0;
        if (($12 | 0) != ($1 | 0)) {
         continue label
        }
        break label;
       };
      }
      if (!$11) {
       break block4
      }
      $1 = $9 + $1 | 0;
      $87 = $1;
      $1 = HEAPU8[$1 >> 0] | 0;
      HEAP8[$87 >> 0] = ((($1 + -97 | 0) & 255 | 0) >>> 0 < 26 >>> 0 ? 32 : 0) ^ $1 | 0;
     }
     _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($5 | 0, $7 + 12 | 0 | 0);
     HEAP32[($3 + 8 | 0) >> 2] = $8;
     HEAP32[($3 + 4 | 0) >> 2] = $9;
     HEAP32[$3 >> 2] = $8;
     HEAP32[(($3 + 24 | 0) + 8 | 0) >> 2] = $8;
     i64toi32_i32$1 = HEAP32[($3 + 4 | 0) >> 2] | 0;
     HEAP32[($3 + 24 | 0) >> 2] = HEAP32[$3 >> 2] | 0;
     HEAP32[($3 + 28 | 0) >> 2] = i64toi32_i32$1;
     _ZN9hashbrown3map28HashMap$LT$K$C$V$C$S$C$A$GT$6insert17h40da1956ffd7c5e2E($3 + 36 | 0 | 0, $2 | 0, $3 + 24 | 0 | 0, $5 | 0);
     block7 : {
      $1 = HEAP32[($3 + 36 | 0) >> 2] | 0;
      if (($1 | -2147483648 | 0 | 0) == (-2147483648 | 0)) {
       break block7
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($3 + 40 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
     }
     $6 = $6 + 1 | 0;
     if (($6 | 0) != ($4 | 0)) {
      continue label1
     }
     break label1;
    };
   }
   __stack_pointer = $3 + 48 | 0;
   return;
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($1 | 0, $8 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3ops8function6FnOnce9call_once17h7ef550448cb3efc3E_llvm_309696905035023971($0) {
  $0 = $0 | 0;
  block : {
   if ((HEAPU8[(0 + 1052312 | 0) >> 0] | 0 | 0) == (1 | 0)) {
    break block
   }
   _ZN3std3sys12thread_local10no_threads20LazyStorage$LT$T$GT$10initialize17h856bdfec157899d7E(1052296 | 0, $0 | 0) | 0;
  }
  return 1052296 | 0;
 }
 
 function _ZN4core3str21_$LT$impl$u20$str$GT$12trim_matches17hb28bc8dcbb172ecfE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $6 = 0, $4 = 0, $8 = 0, $3 = 0, $7 = 0, $5 = 0, $9 = 0, $10 = 0;
  $3 = $1 + $2 | 0;
  $4 = 0;
  block11 : {
   block1 : {
    block : {
     if ($2) {
      break block
     }
     $2 = $1;
     $5 = 0;
     break block1;
    }
    $2 = $1;
    label : while (1) {
     $5 = $4;
     block3 : {
      block2 : {
       $4 = $2;
       $6 = HEAP8[$2 >> 0] | 0;
       if (($6 | 0) <= (-1 | 0)) {
        break block2
       }
       $2 = $2 + 1 | 0;
       $6 = $6 & 255 | 0;
       break block3;
      }
      $2 = (HEAPU8[($4 + 1 | 0) >> 0] | 0) & 63 | 0;
      $7 = $6 & 31 | 0;
      block4 : {
       if ($6 >>> 0 > -33 >>> 0) {
        break block4
       }
       $6 = $7 << 6 | 0 | $2 | 0;
       $2 = $4 + 2 | 0;
       break block3;
      }
      $2 = $2 << 6 | 0 | ((HEAPU8[($4 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
      block5 : {
       if ($6 >>> 0 >= -16 >>> 0) {
        break block5
       }
       $6 = $2 | ($7 << 12 | 0) | 0;
       $2 = $4 + 3 | 0;
       break block3;
      }
      $6 = $2 << 6 | 0 | ((HEAPU8[($4 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($7 << 18 | 0) & 1835008 | 0) | 0;
      $2 = $4 + 4 | 0;
     }
     $4 = ($2 - $4 | 0) + $5 | 0;
     block6 : {
      if (($6 + -9 | 0) >>> 0 < 5 >>> 0) {
       break block6
      }
      if (($6 | 0) == (32 | 0)) {
       break block6
      }
      if ($6 >>> 0 < 128 >>> 0) {
       break block1
      }
      block9 : {
       block8 : {
        block7 : {
         block10 : {
          $7 = $6 >>> 8 | 0;
          switch ($7 + -22 | 0 | 0) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
          case 18:
          case 19:
          case 20:
          case 21:
          case 22:
          case 23:
          case 24:
          case 25:
           break block1;
          case 0:
           break block7;
          case 10:
           break block8;
          case 26:
           break block9;
          default:
           break block10;
          };
         }
         if ($7) {
          break block1
         }
         if (!((HEAPU8[(($6 & 255 | 0) + 1050960 | 0) >> 0] | 0) & 1 | 0)) {
          break block1
         }
         break block6;
        }
        if (($6 | 0) != (5760 | 0)) {
         break block1
        }
        break block6;
       }
       if (!((HEAPU8[(($6 & 255 | 0) + 1050960 | 0) >> 0] | 0) & 2 | 0)) {
        break block1
       }
       break block6;
      }
      if (($6 | 0) != (12288 | 0)) {
       break block1
      }
     }
     if (($2 | 0) != ($3 | 0)) {
      continue label
     }
     break label;
    };
    $5 = 0;
    $4 = 0;
    break block11;
   }
   if (($2 | 0) == ($3 | 0)) {
    break block11
   }
   label1 : while (1) {
    block12 : {
     $7 = $3;
     $3 = $7 + -1 | 0;
     $6 = HEAP8[$3 >> 0] | 0;
     if (($6 | 0) > (-1 | 0)) {
      break block12
     }
     block14 : {
      block13 : {
       $3 = $7 + -2 | 0;
       $8 = HEAPU8[$3 >> 0] | 0;
       $9 = $8 << 24 >> 24;
       if (($9 | 0) < (-64 | 0)) {
        break block13
       }
       $8 = $8 & 31 | 0;
       break block14;
      }
      block16 : {
       block15 : {
        $3 = $7 + -3 | 0;
        $8 = HEAPU8[$3 >> 0] | 0;
        $10 = $8 << 24 >> 24;
        if (($10 | 0) < (-64 | 0)) {
         break block15
        }
        $8 = $8 & 15 | 0;
        break block16;
       }
       $3 = $7 + -4 | 0;
       $8 = ((HEAPU8[$3 >> 0] | 0) & 7 | 0) << 6 | 0 | ($10 & 63 | 0) | 0;
      }
      $8 = $8 << 6 | 0 | ($9 & 63 | 0) | 0;
     }
     $6 = $8 << 6 | 0 | ($6 & 63 | 0) | 0;
    }
    block18 : {
     block17 : {
      if (($6 + -9 | 0) >>> 0 < 5 >>> 0) {
       break block17
      }
      if (($6 | 0) == (32 | 0)) {
       break block17
      }
      if ($6 >>> 0 < 128 >>> 0) {
       break block18
      }
      block22 : {
       block21 : {
        block20 : {
         block19 : {
          $8 = $6 >>> 8 | 0;
          switch ($8 + -22 | 0 | 0) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
          case 18:
          case 19:
          case 20:
          case 21:
          case 22:
          case 23:
          case 24:
          case 25:
           break block18;
          case 0:
           break block19;
          case 10:
           break block20;
          case 26:
           break block21;
          default:
           break block22;
          };
         }
         if (($6 | 0) == (5760 | 0)) {
          break block17
         }
         break block18;
        }
        if ((HEAPU8[(($6 & 255 | 0) + 1050960 | 0) >> 0] | 0) & 2 | 0) {
         break block17
        }
        break block18;
       }
       if (($6 | 0) != (12288 | 0)) {
        break block18
       }
       break block17;
      }
      if ($8) {
       break block18
      }
      if (!((HEAPU8[(($6 & 255 | 0) + 1050960 | 0) >> 0] | 0) & 1 | 0)) {
       break block18
      }
     }
     if (($2 | 0) != ($3 | 0)) {
      continue label1
     }
     break block11;
    }
    break label1;
   };
   $4 = ($4 - $2 | 0) + $7 | 0;
  }
  HEAP32[($0 + 4 | 0) >> 2] = $4 - $5 | 0;
  HEAP32[$0 >> 2] = $1 + $5 | 0;
 }
 
 function _ZN4core4hash11BuildHasher8hash_one17hafe0ce79328045e6E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$5 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $4 = 0, $5$hi = 0, $7$hi = 0, $5 = 0, $8 = 0, $6$hi = 0, $8$hi = 0, $7 = 0, $2 = 0, $6 = 0, $9 = 0, $9$hi = 0, $3 = 0, $92 = 0, $27 = 0, $30 = 0, $33 = 0, $36 = 0, $62 = 0, $62$hi = 0, $63 = 0, $63$hi = 0, $65$hi = 0, $70 = 0, $70$hi = 0, $77 = 0, $77$hi = 0, $78 = 0, $78$hi = 0, $83 = 0, $83$hi = 0, $88 = 0, $88$hi = 0, $89 = 0, $89$hi = 0, $92$hi = 0, $99 = 0, $99$hi = 0, $104 = 0, $104$hi = 0, $105 = 0, $105$hi = 0, $108 = 0, $108$hi = 0, $111 = 0, $111$hi = 0, $116 = 0, $116$hi = 0, $121 = 0, $121$hi = 0, $122 = 0, $122$hi = 0, $125 = 0, $125$hi = 0, $131 = 0, $131$hi = 0, $136 = 0, $136$hi = 0, $137 = 0, $137$hi = 0, $140 = 0, $140$hi = 0, $146 = 0, $146$hi = 0, $151 = 0, $151$hi = 0, $152 = 0, $152$hi = 0, $154$hi = 0, $161 = 0, $161$hi = 0, $93 = 0, $165 = 0, $165$hi = 0, $167$hi = 0, $171 = 0, $171$hi = 0, $174$hi = 0, $177 = 0, $177$hi = 0, $178 = 0, $178$hi = 0, $183 = 0, $183$hi = 0, $184$hi = 0;
  $2 = __stack_pointer - 80 | 0;
  __stack_pointer = $2;
  $3 = $2 + 64 | 0;
  i64toi32_i32$1 = $3;
  i64toi32_i32$0 = 0;
  HEAP32[i64toi32_i32$1 >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $2;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 56 | 0) >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 60 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = $0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
  $4 = i64toi32_i32$0;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$0 = $2;
  HEAP32[(i64toi32_i32$0 + 48 | 0) >> 2] = $4;
  HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $5 = i64toi32_i32$1;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = $2;
  HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$2 = $4;
  i64toi32_i32$1 = 1952801890;
  i64toi32_i32$3 = 2037671283;
  i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
  $27 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$2 = $2;
  HEAP32[(i64toi32_i32$2 + 32 | 0) >> 2] = $27;
  HEAP32[(i64toi32_i32$2 + 36 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$0 = $4;
  i64toi32_i32$2 = 1685025377;
  i64toi32_i32$3 = 1852075885;
  i64toi32_i32$2 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
  $30 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $2;
  HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $30;
  HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $5$hi;
  i64toi32_i32$1 = $5;
  i64toi32_i32$0 = 1819895653;
  i64toi32_i32$3 = 1852142177;
  i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
  $33 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$1 = $2;
  HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $33;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$2 = $5;
  i64toi32_i32$1 = 1936682341;
  i64toi32_i32$3 = 1886610805;
  i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
  $36 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$2 = $2;
  HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] = $36;
  HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] = i64toi32_i32$1;
  _ZN71_$LT$core__hash__sip__Hasher$LT$S$GT$$u20$as$u20$core__hash__Hasher$GT$5write17h72e582c7f3f69cf0E(i64toi32_i32$2 + 8 | 0 | 0, HEAP32[($1 + 4 | 0) >> 2] | 0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0);
  HEAP8[(i64toi32_i32$2 + 79 | 0) >> 0] = 255;
  _ZN71_$LT$core__hash__sip__Hasher$LT$S$GT$$u20$as$u20$core__hash__Hasher$GT$5write17h72e582c7f3f69cf0E(i64toi32_i32$2 + 8 | 0 | 0, i64toi32_i32$2 + 79 | 0 | 0, 1 | 0);
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] | 0;
  $5 = i64toi32_i32$1;
  $5$hi = i64toi32_i32$2;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] | 0;
  $4 = i64toi32_i32$2;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$0 = $3;
  i64toi32_i32$1 = HEAP32[i64toi32_i32$0 >> 2] | 0;
  i64toi32_i32$2 = 0;
  $6 = i64toi32_i32$1;
  $6$hi = i64toi32_i32$2;
  i64toi32_i32$0 = $2;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 56 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 60 | 0) >> 2] | 0;
  $7 = i64toi32_i32$2;
  $7$hi = i64toi32_i32$1;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 32 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 36 | 0) >> 2] | 0;
  $8 = i64toi32_i32$1;
  $8$hi = i64toi32_i32$2;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] | 0;
  $9 = i64toi32_i32$2;
  $9$hi = i64toi32_i32$1;
  __stack_pointer = i64toi32_i32$0 + 80 | 0;
  i64toi32_i32$1 = $8$hi;
  $62 = $8;
  $62$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $7$hi;
  $63 = $7;
  $63$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$0 = $6;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 56;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   $92 = 0;
  } else {
   i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $92 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
  }
  $65$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $63$hi;
  i64toi32_i32$1 = $63;
  i64toi32_i32$0 = $65$hi;
  i64toi32_i32$3 = $92;
  i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
  $6 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
  $6$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $62$hi;
  i64toi32_i32$2 = $62;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$3 = $6;
  i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
  $7 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
  $7$hi = i64toi32_i32$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$2 = __wasm_rotl_i64($7 | 0, i64toi32_i32$1 | 0, 16 | 0, i64toi32_i32$2 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $70 = i64toi32_i32$2;
  $70$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $7$hi;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$1 = $7$hi;
  i64toi32_i32$0 = $7;
  i64toi32_i32$2 = $9$hi;
  i64toi32_i32$3 = $9;
  i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
  if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $7 = i64toi32_i32$4;
  $7$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $70$hi;
  i64toi32_i32$1 = $70;
  i64toi32_i32$0 = $7$hi;
  i64toi32_i32$3 = i64toi32_i32$4;
  i64toi32_i32$0 = i64toi32_i32$5 ^ i64toi32_i32$0 | 0;
  $8 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
  $8$hi = i64toi32_i32$0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$1 = __wasm_rotl_i64($8 | 0, i64toi32_i32$0 | 0, 21 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $77 = i64toi32_i32$1;
  $77$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $8$hi;
  $78 = $8;
  $78$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$5 = $4;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$3 = $5;
  i64toi32_i32$2 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
  i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
  if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
  }
  $5 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$4;
  i64toi32_i32$5 = 0;
  i64toi32_i32$5 = __wasm_rotl_i64(i64toi32_i32$2 | 0, i64toi32_i32$4 | 0, 32 | 0, i64toi32_i32$5 | 0) | 0;
  i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
  $83 = i64toi32_i32$5;
  $83$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $78$hi;
  i64toi32_i32$0 = $78;
  i64toi32_i32$5 = $83$hi;
  i64toi32_i32$3 = $83;
  i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
  }
  $8 = i64toi32_i32$1;
  $8$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $77$hi;
  i64toi32_i32$4 = $77;
  i64toi32_i32$0 = $8$hi;
  i64toi32_i32$3 = i64toi32_i32$1;
  i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
  $9 = i64toi32_i32$4 ^ i64toi32_i32$1 | 0;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$4 = 0;
  i64toi32_i32$4 = __wasm_rotl_i64($9 | 0, i64toi32_i32$0 | 0, 16 | 0, i64toi32_i32$4 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $88 = i64toi32_i32$4;
  $88$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $9$hi;
  $89 = $9;
  $89$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $7$hi;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$4 = 0;
  i64toi32_i32$4 = __wasm_rotl_i64($4 | 0, i64toi32_i32$0 | 0, 13 | 0, i64toi32_i32$4 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $92$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$0 = $92$hi;
  i64toi32_i32$2 = i64toi32_i32$4;
  i64toi32_i32$4 = $5$hi;
  i64toi32_i32$3 = $5;
  i64toi32_i32$4 = i64toi32_i32$0 ^ i64toi32_i32$4 | 0;
  $4 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $7$hi;
  i64toi32_i32$0 = $7;
  i64toi32_i32$2 = $4$hi;
  i64toi32_i32$3 = $4;
  i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
  if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
  }
  $5 = i64toi32_i32$5;
  $5$hi = i64toi32_i32$1;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64(i64toi32_i32$5 | 0, i64toi32_i32$1 | 0, 32 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$4 = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 255;
  i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
  $99 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
  $99$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $89$hi;
  i64toi32_i32$1 = $89;
  i64toi32_i32$4 = $99$hi;
  i64toi32_i32$3 = $99;
  i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
  if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $7 = i64toi32_i32$2;
  $7$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $88$hi;
  i64toi32_i32$0 = $88;
  i64toi32_i32$1 = $7$hi;
  i64toi32_i32$3 = i64toi32_i32$2;
  i64toi32_i32$1 = i64toi32_i32$5 ^ i64toi32_i32$1 | 0;
  $9 = i64toi32_i32$0 ^ i64toi32_i32$2 | 0;
  $9$hi = i64toi32_i32$1;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64($9 | 0, i64toi32_i32$1 | 0, 21 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $104 = i64toi32_i32$0;
  $104$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  $105 = $9;
  $105$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $8$hi;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$1 = $8$hi;
  i64toi32_i32$5 = $8;
  i64toi32_i32$0 = $6$hi;
  i64toi32_i32$3 = $6;
  i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
  $108 = i64toi32_i32$5 ^ i64toi32_i32$3 | 0;
  $108$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$5 = 0;
  i64toi32_i32$5 = __wasm_rotl_i64($4 | 0, i64toi32_i32$0 | 0, 17 | 0, i64toi32_i32$5 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $111 = i64toi32_i32$5;
  $111$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$1 = $5;
  i64toi32_i32$5 = $111$hi;
  i64toi32_i32$3 = $111;
  i64toi32_i32$5 = i64toi32_i32$0 ^ i64toi32_i32$5 | 0;
  $4 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $108$hi;
  i64toi32_i32$0 = $108;
  i64toi32_i32$1 = $4$hi;
  i64toi32_i32$3 = $4;
  i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$2 = i64toi32_i32$5 + i64toi32_i32$1 | 0;
  if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
  }
  $5 = i64toi32_i32$4;
  $5$hi = i64toi32_i32$2;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64(i64toi32_i32$4 | 0, i64toi32_i32$2 | 0, 32 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
  $116 = i64toi32_i32$0;
  $116$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $105$hi;
  i64toi32_i32$5 = $105;
  i64toi32_i32$0 = $116$hi;
  i64toi32_i32$3 = $116;
  i64toi32_i32$1 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
  i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$0 | 0;
  if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
  }
  $6 = i64toi32_i32$1;
  $6$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $104$hi;
  i64toi32_i32$2 = $104;
  i64toi32_i32$5 = $6$hi;
  i64toi32_i32$3 = i64toi32_i32$1;
  i64toi32_i32$5 = i64toi32_i32$4 ^ i64toi32_i32$5 | 0;
  $8 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
  $8$hi = i64toi32_i32$5;
  i64toi32_i32$2 = 0;
  i64toi32_i32$2 = __wasm_rotl_i64($8 | 0, i64toi32_i32$5 | 0, 16 | 0, i64toi32_i32$2 | 0) | 0;
  i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
  $121 = i64toi32_i32$2;
  $121$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $8$hi;
  $122 = $8;
  $122$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $5$hi;
  i64toi32_i32$5 = $4$hi;
  i64toi32_i32$2 = 0;
  i64toi32_i32$2 = __wasm_rotl_i64($4 | 0, i64toi32_i32$5 | 0, 13 | 0, i64toi32_i32$2 | 0) | 0;
  i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
  $125 = i64toi32_i32$2;
  $125$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $5$hi;
  i64toi32_i32$4 = $5;
  i64toi32_i32$2 = $125$hi;
  i64toi32_i32$3 = $125;
  i64toi32_i32$2 = i64toi32_i32$5 ^ i64toi32_i32$2 | 0;
  $4 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $7$hi;
  i64toi32_i32$2 = $4$hi;
  i64toi32_i32$5 = $4;
  i64toi32_i32$4 = $7$hi;
  i64toi32_i32$3 = $7;
  i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
  i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$4 | 0;
  if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
  }
  $5 = i64toi32_i32$0;
  $5$hi = i64toi32_i32$1;
  i64toi32_i32$5 = 0;
  i64toi32_i32$5 = __wasm_rotl_i64(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, 32 | 0, i64toi32_i32$5 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $131 = i64toi32_i32$5;
  $131$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $122$hi;
  i64toi32_i32$2 = $122;
  i64toi32_i32$5 = $131$hi;
  i64toi32_i32$3 = $131;
  i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
  i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
  }
  $7 = i64toi32_i32$4;
  $7$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $121$hi;
  i64toi32_i32$1 = $121;
  i64toi32_i32$2 = $7$hi;
  i64toi32_i32$3 = i64toi32_i32$4;
  i64toi32_i32$2 = i64toi32_i32$0 ^ i64toi32_i32$2 | 0;
  $8 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
  $8$hi = i64toi32_i32$2;
  i64toi32_i32$1 = 0;
  i64toi32_i32$1 = __wasm_rotl_i64($8 | 0, i64toi32_i32$2 | 0, 21 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
  $136 = i64toi32_i32$1;
  $136$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $8$hi;
  $137 = $8;
  $137$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $5$hi;
  i64toi32_i32$2 = $4$hi;
  i64toi32_i32$1 = 0;
  i64toi32_i32$1 = __wasm_rotl_i64($4 | 0, i64toi32_i32$2 | 0, 17 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
  $140 = i64toi32_i32$1;
  $140$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $5$hi;
  i64toi32_i32$0 = $5;
  i64toi32_i32$1 = $140$hi;
  i64toi32_i32$3 = $140;
  i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
  $4 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$1 = $4$hi;
  i64toi32_i32$2 = $4;
  i64toi32_i32$0 = $6$hi;
  i64toi32_i32$3 = $6;
  i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
  i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
  if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
  }
  $5 = i64toi32_i32$5;
  $5$hi = i64toi32_i32$4;
  i64toi32_i32$2 = 0;
  i64toi32_i32$2 = __wasm_rotl_i64(i64toi32_i32$5 | 0, i64toi32_i32$4 | 0, 32 | 0, i64toi32_i32$2 | 0) | 0;
  i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
  $146 = i64toi32_i32$2;
  $146$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $137$hi;
  i64toi32_i32$1 = $137;
  i64toi32_i32$2 = $146$hi;
  i64toi32_i32$3 = $146;
  i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
  if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $6 = i64toi32_i32$0;
  $6$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $136$hi;
  i64toi32_i32$4 = $136;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$3 = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$5 ^ i64toi32_i32$1 | 0;
  $8 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
  $8$hi = i64toi32_i32$1;
  i64toi32_i32$4 = 0;
  i64toi32_i32$4 = __wasm_rotl_i64($8 | 0, i64toi32_i32$1 | 0, 16 | 0, i64toi32_i32$4 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $151 = i64toi32_i32$4;
  $151$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $8$hi;
  $152 = $8;
  $152$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $4$hi;
  i64toi32_i32$4 = 0;
  i64toi32_i32$4 = __wasm_rotl_i64($4 | 0, i64toi32_i32$1 | 0, 13 | 0, i64toi32_i32$4 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $154$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$1 = $154$hi;
  i64toi32_i32$5 = i64toi32_i32$4;
  i64toi32_i32$4 = $5$hi;
  i64toi32_i32$3 = $5;
  i64toi32_i32$4 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
  $4 = i64toi32_i32$5 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $7$hi;
  i64toi32_i32$4 = $4$hi;
  i64toi32_i32$1 = $4;
  i64toi32_i32$5 = $7$hi;
  i64toi32_i32$3 = $7;
  i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$0 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
  }
  $5 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$1 = __wasm_rotl_i64(i64toi32_i32$2 | 0, i64toi32_i32$0 | 0, 32 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $161 = i64toi32_i32$1;
  $161$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $152$hi;
  i64toi32_i32$4 = $152;
  i64toi32_i32$1 = $161$hi;
  i64toi32_i32$3 = $161;
  i64toi32_i32$5 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
  i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
  if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
  }
  $7 = i64toi32_i32$5;
  $7$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $151$hi;
  i64toi32_i32$0 = $151;
  i64toi32_i32$4 = $7$hi;
  i64toi32_i32$3 = i64toi32_i32$5;
  i64toi32_i32$4 = i64toi32_i32$2 ^ i64toi32_i32$4 | 0;
  $93 = i64toi32_i32$0 ^ i64toi32_i32$5 | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64($93 | 0, i64toi32_i32$4 | 0, 21 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
  $165 = i64toi32_i32$0;
  $165$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $4$hi;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64($4 | 0, i64toi32_i32$4 | 0, 17 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
  $167$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $5$hi;
  i64toi32_i32$4 = $167$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$3 = $5;
  i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
  $4 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
  $4$hi = i64toi32_i32$0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$2 = __wasm_rotl_i64($4 | 0, i64toi32_i32$0 | 0, 13 | 0, i64toi32_i32$2 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $171 = i64toi32_i32$2;
  $171$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$0 = $6$hi;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$4 = $4;
  i64toi32_i32$2 = $6$hi;
  i64toi32_i32$3 = $6;
  i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
  if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $174$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $171$hi;
  i64toi32_i32$0 = $171;
  i64toi32_i32$4 = $174$hi;
  i64toi32_i32$3 = i64toi32_i32$1;
  i64toi32_i32$4 = i64toi32_i32$5 ^ i64toi32_i32$4 | 0;
  $4 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
  $4$hi = i64toi32_i32$4;
  i64toi32_i32$0 = 0;
  i64toi32_i32$0 = __wasm_rotl_i64($4 | 0, i64toi32_i32$4 | 0, 17 | 0, i64toi32_i32$0 | 0) | 0;
  i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
  $177 = i64toi32_i32$0;
  $177$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $165$hi;
  i64toi32_i32$5 = $165;
  i64toi32_i32$0 = $177$hi;
  i64toi32_i32$3 = $177;
  i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
  $178 = i64toi32_i32$5 ^ i64toi32_i32$3 | 0;
  $178$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$0 = $7$hi;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$4 = $4;
  i64toi32_i32$5 = $7$hi;
  i64toi32_i32$3 = $7;
  i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
  i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
  }
  $4 = i64toi32_i32$2;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$4 = 0;
  i64toi32_i32$4 = __wasm_rotl_i64(i64toi32_i32$2 | 0, i64toi32_i32$1 | 0, 32 | 0, i64toi32_i32$4 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $183 = i64toi32_i32$4;
  $183$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $178$hi;
  i64toi32_i32$0 = $178;
  i64toi32_i32$4 = $183$hi;
  i64toi32_i32$3 = $183;
  i64toi32_i32$4 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
  $184$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $4$hi;
  i64toi32_i32$4 = $184$hi;
  i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$3 = i64toi32_i32$2;
  i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
  i64toi32_i32$1 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function _ZN71_$LT$core__hash__sip__Hasher$LT$S$GT$$u20$as$u20$core__hash__Hasher$GT$5write17h72e582c7f3f69cf0E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $7$hi = 0, $7 = 0, $8$hi = 0, $10$hi = 0, $8 = 0, $5 = 0, $4 = 0, $10 = 0, $9$hi = 0, $9 = 0, $11$hi = 0, $3 = 0, $11 = 0, $12$hi = 0, $6 = 0, $77 = 0, $79 = 0, $80 = 0, $12 = 0, $81 = 0, $82 = 0, $40$hi = 0, $43$hi = 0, $44$hi = 0, $55$hi = 0, $58$hi = 0, $59$hi = 0, $62 = 0, $64 = 0, $64$hi = 0, $69$hi = 0, $70$hi = 0, $76 = 0, $78 = 0, $78$hi = 0, $80$hi = 0, $85 = 0, $85$hi = 0, $89 = 0, $89$hi = 0, $92 = 0, $92$hi = 0, $100 = 0, $100$hi = 0, $101 = 0, $104 = 0, $105 = 0, $108 = 0, $108$hi = 0, $111 = 0, $111$hi = 0, $114 = 0, $114$hi = 0, $117 = 0, $121 = 0, $154 = 0, $154$hi = 0, $160 = 0, $160$hi = 0, $166 = 0, $166$hi = 0, $170 = 0, $170$hi = 0, $173 = 0, $173$hi = 0, $176 = 0, $176$hi = 0, $213$hi = 0, $216$hi = 0, $217$hi = 0, $230$hi = 0, $233$hi = 0, $234$hi = 0;
  HEAP32[($0 + 56 | 0) >> 2] = (HEAP32[($0 + 56 | 0) >> 2] | 0) + $2 | 0;
  block1 : {
   block : {
    $3 = HEAP32[($0 + 60 | 0) >> 2] | 0;
    if ($3) {
     break block
    }
    $4 = 0;
    break block1;
   }
   $5 = 4;
   block3 : {
    block2 : {
     $4 = 8 - $3 | 0;
     $6 = $4 >>> 0 < $2 >>> 0 ? $4 : $2;
     if ($6 >>> 0 >= 4 >>> 0) {
      break block2
     }
     i64toi32_i32$0 = 0;
     $7 = 0;
     $7$hi = i64toi32_i32$0;
     $5 = 0;
     break block3;
    }
    i64toi32_i32$2 = $1;
    i64toi32_i32$0 = HEAPU8[i64toi32_i32$2 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
    i64toi32_i32$1 = 0;
    $7 = i64toi32_i32$0;
    $7$hi = i64toi32_i32$1;
   }
   block4 : {
    if (($5 | 1 | 0) >>> 0 >= $6 >>> 0) {
     break block4
    }
    i64toi32_i32$2 = $1 + $5 | 0;
    i64toi32_i32$1 = HEAPU8[i64toi32_i32$2 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
    i64toi32_i32$0 = 0;
    $40$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $43$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $40$hi;
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$1 = $43$hi;
    i64toi32_i32$3 = $5 << 3 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $77 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $77 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $44$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$1 = $44$hi;
    i64toi32_i32$0 = $77;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
    $7 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
    $7$hi = i64toi32_i32$2;
    $5 = $5 | 2 | 0;
   }
   block5 : {
    if ($5 >>> 0 >= $6 >>> 0) {
     break block5
    }
    i64toi32_i32$1 = $1 + $5 | 0;
    i64toi32_i32$2 = HEAPU8[i64toi32_i32$1 >> 0] | 0;
    i64toi32_i32$0 = 0;
    $55$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $58$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $55$hi;
    i64toi32_i32$1 = i64toi32_i32$2;
    i64toi32_i32$2 = $58$hi;
    i64toi32_i32$3 = $5 << 3 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
     $79 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $79 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    }
    $59$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$2 = $59$hi;
    i64toi32_i32$0 = $79;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
    $7 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
    $7$hi = i64toi32_i32$1;
   }
   $62 = $0;
   i64toi32_i32$2 = $0;
   i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 48 | 0) >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 52 | 0) >> 2] | 0;
   $64 = i64toi32_i32$1;
   $64$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $7$hi;
   i64toi32_i32$0 = 0;
   $69$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $7$hi;
   i64toi32_i32$2 = $7;
   i64toi32_i32$1 = $69$hi;
   i64toi32_i32$3 = ($3 << 3 | 0) & 56 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $80 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $80 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $70$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $64$hi;
   i64toi32_i32$0 = $64;
   i64toi32_i32$2 = $70$hi;
   i64toi32_i32$3 = $80;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $7 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   $7$hi = i64toi32_i32$2;
   i64toi32_i32$0 = $62;
   HEAP32[(i64toi32_i32$0 + 48 | 0) >> 2] = $7;
   HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] = i64toi32_i32$2;
   block6 : {
    if ($2 >>> 0 < $4 >>> 0) {
     break block6
    }
    $76 = $0;
    i64toi32_i32$1 = $0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] | 0;
    $78 = i64toi32_i32$2;
    $78$hi = i64toi32_i32$0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] | 0;
    $80$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$2 = $80$hi;
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$0 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
    $8 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
    $8$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $78$hi;
    i64toi32_i32$2 = $78;
    i64toi32_i32$1 = $8$hi;
    i64toi32_i32$3 = $8;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    $9 = i64toi32_i32$4;
    $9$hi = i64toi32_i32$5;
    $85 = i64toi32_i32$4;
    $85$hi = i64toi32_i32$5;
    i64toi32_i32$0 = $0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] | 0;
    $10 = i64toi32_i32$5;
    $10$hi = i64toi32_i32$2;
    i64toi32_i32$5 = 0;
    i64toi32_i32$5 = __wasm_rotl_i64($10 | 0, i64toi32_i32$2 | 0, 13 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $89 = i64toi32_i32$5;
    $89$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $10$hi;
    i64toi32_i32$2 = HEAP32[i64toi32_i32$0 >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
    $92 = i64toi32_i32$2;
    $92$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $10$hi;
    i64toi32_i32$0 = $10;
    i64toi32_i32$2 = $92$hi;
    i64toi32_i32$3 = $92;
    i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $10 = i64toi32_i32$1;
    $10$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $89$hi;
    i64toi32_i32$5 = $89;
    i64toi32_i32$0 = $10$hi;
    i64toi32_i32$3 = i64toi32_i32$1;
    i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
    $11 = i64toi32_i32$5 ^ i64toi32_i32$1 | 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $85$hi;
    i64toi32_i32$4 = $85;
    i64toi32_i32$5 = $11$hi;
    i64toi32_i32$3 = $11;
    i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
    i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $12 = i64toi32_i32$2;
    $12$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$4 = 0;
    i64toi32_i32$4 = __wasm_rotl_i64($11 | 0, i64toi32_i32$1 | 0, 17 | 0, i64toi32_i32$4 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $100 = i64toi32_i32$4;
    $100$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $12$hi;
    i64toi32_i32$0 = i64toi32_i32$2;
    i64toi32_i32$4 = $100$hi;
    i64toi32_i32$3 = $100;
    i64toi32_i32$4 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
    $101 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $76;
    HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] = $101;
    HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] = i64toi32_i32$4;
    i64toi32_i32$4 = i64toi32_i32$1;
    i64toi32_i32$4 = i64toi32_i32$1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_rotl_i64(i64toi32_i32$2 | 0, i64toi32_i32$1 | 0, 32 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $104 = i64toi32_i32$0;
    i64toi32_i32$0 = $0;
    HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $104;
    HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$4;
    $105 = i64toi32_i32$0;
    i64toi32_i32$4 = $9$hi;
    i64toi32_i32$4 = $8$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_rotl_i64($8 | 0, i64toi32_i32$4 | 0, 16 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $108 = i64toi32_i32$0;
    $108$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $9$hi;
    i64toi32_i32$1 = $9;
    i64toi32_i32$0 = $108$hi;
    i64toi32_i32$3 = $108;
    i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
    $8 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
    $8$hi = i64toi32_i32$0;
    i64toi32_i32$1 = 0;
    i64toi32_i32$1 = __wasm_rotl_i64($8 | 0, i64toi32_i32$0 | 0, 21 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111 = i64toi32_i32$1;
    $111$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$0 = $10$hi;
    i64toi32_i32$1 = 0;
    i64toi32_i32$1 = __wasm_rotl_i64($10 | 0, i64toi32_i32$0 | 0, 32 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $114 = i64toi32_i32$1;
    $114$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$4 = $8;
    i64toi32_i32$1 = $114$hi;
    i64toi32_i32$3 = $114;
    i64toi32_i32$5 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
    i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
    }
    $8 = i64toi32_i32$5;
    $8$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $111$hi;
    i64toi32_i32$0 = $111;
    i64toi32_i32$4 = $8$hi;
    i64toi32_i32$3 = i64toi32_i32$5;
    i64toi32_i32$4 = i64toi32_i32$2 ^ i64toi32_i32$4 | 0;
    $117 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $105;
    HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $117;
    HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$4;
    i64toi32_i32$4 = $8$hi;
    i64toi32_i32$4 = $7$hi;
    i64toi32_i32$4 = $8$hi;
    i64toi32_i32$2 = i64toi32_i32$3;
    i64toi32_i32$0 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
    $121 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$2 = $0;
    HEAP32[i64toi32_i32$2 >> 2] = $121;
    HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$0;
    break block1;
   }
   HEAP32[($0 + 60 | 0) >> 2] = $3 + $2 | 0;
   return;
  }
  $2 = $2 - $4 | 0;
  $5 = $2 & 7 | 0;
  block7 : {
   $2 = $2 & -8 | 0;
   if ($4 >>> 0 >= $2 >>> 0) {
    break block7
   }
   i64toi32_i32$4 = $0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 8 | 0) >> 2] | 0;
   i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 12 | 0) >> 2] | 0;
   $8 = i64toi32_i32$0;
   $8$hi = i64toi32_i32$2;
   i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 16 | 0) >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 20 | 0) >> 2] | 0;
   $7 = i64toi32_i32$2;
   $7$hi = i64toi32_i32$0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 24 | 0) >> 2] | 0;
   i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 28 | 0) >> 2] | 0;
   $9 = i64toi32_i32$0;
   $9$hi = i64toi32_i32$2;
   i64toi32_i32$2 = HEAP32[i64toi32_i32$4 >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 4 | 0) >> 2] | 0;
   $10 = i64toi32_i32$2;
   $10$hi = i64toi32_i32$0;
   label : while (1) {
    i64toi32_i32$4 = $1 + $4 | 0;
    i64toi32_i32$0 = HEAPU8[i64toi32_i32$4 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$4 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$4 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$4 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
    i64toi32_i32$2 = HEAPU8[(i64toi32_i32$4 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$4 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$4 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$4 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
    $11 = i64toi32_i32$0;
    $11$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $9$hi;
    i64toi32_i32$2 = $11$hi;
    i64toi32_i32$4 = i64toi32_i32$0;
    i64toi32_i32$0 = $9$hi;
    i64toi32_i32$3 = $9;
    i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
    $9 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
    $9$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$0 = $9$hi;
    i64toi32_i32$2 = $9;
    i64toi32_i32$4 = $8$hi;
    i64toi32_i32$3 = $8;
    i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    $8 = i64toi32_i32$1;
    $8$hi = i64toi32_i32$5;
    $154 = i64toi32_i32$1;
    $154$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $10$hi;
    i64toi32_i32$5 = $7$hi;
    i64toi32_i32$5 = $10$hi;
    i64toi32_i32$0 = $10;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$1 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $10 = i64toi32_i32$4;
    $10$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_rotl_i64($7 | 0, i64toi32_i32$1 | 0, 13 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $160 = i64toi32_i32$0;
    $160$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $10$hi;
    i64toi32_i32$5 = i64toi32_i32$4;
    i64toi32_i32$0 = $160$hi;
    i64toi32_i32$3 = $160;
    i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
    $7 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
    $7$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $154$hi;
    i64toi32_i32$1 = $154;
    i64toi32_i32$5 = $7$hi;
    i64toi32_i32$3 = $7;
    i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $12 = i64toi32_i32$2;
    $12$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $7$hi;
    i64toi32_i32$1 = 0;
    i64toi32_i32$1 = __wasm_rotl_i64($7 | 0, i64toi32_i32$4 | 0, 17 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $166 = i64toi32_i32$1;
    $166$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $12$hi;
    i64toi32_i32$0 = i64toi32_i32$2;
    i64toi32_i32$1 = $166$hi;
    i64toi32_i32$3 = $166;
    i64toi32_i32$1 = i64toi32_i32$4 ^ i64toi32_i32$1 | 0;
    $7 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
    $7$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $8$hi;
    i64toi32_i32$1 = $9$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_rotl_i64($9 | 0, i64toi32_i32$1 | 0, 16 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $170 = i64toi32_i32$0;
    $170$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $8$hi;
    i64toi32_i32$4 = $8;
    i64toi32_i32$0 = $170$hi;
    i64toi32_i32$3 = $170;
    i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
    $8 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
    $8$hi = i64toi32_i32$0;
    i64toi32_i32$4 = 0;
    i64toi32_i32$4 = __wasm_rotl_i64($8 | 0, i64toi32_i32$0 | 0, 21 | 0, i64toi32_i32$4 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $173 = i64toi32_i32$4;
    $173$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$0 = $10$hi;
    i64toi32_i32$4 = 0;
    i64toi32_i32$4 = __wasm_rotl_i64($10 | 0, i64toi32_i32$0 | 0, 32 | 0, i64toi32_i32$4 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $176 = i64toi32_i32$4;
    $176$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$1 = $8;
    i64toi32_i32$4 = $176$hi;
    i64toi32_i32$3 = $176;
    i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
    i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
    }
    $10 = i64toi32_i32$5;
    $10$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $173$hi;
    i64toi32_i32$0 = $173;
    i64toi32_i32$1 = $10$hi;
    i64toi32_i32$3 = i64toi32_i32$5;
    i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
    $9 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
    $9$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $12$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_rotl_i64($12 | 0, i64toi32_i32$1 | 0, 32 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $8 = i64toi32_i32$0;
    $8$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $10$hi;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$1 = $10$hi;
    i64toi32_i32$2 = i64toi32_i32$3;
    i64toi32_i32$0 = $11$hi;
    i64toi32_i32$3 = $11;
    i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
    $10 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    $10$hi = i64toi32_i32$0;
    $4 = $4 + 8 | 0;
    if ($4 >>> 0 < $2 >>> 0) {
     continue label
    }
    break label;
   };
   i64toi32_i32$0 = $7$hi;
   i64toi32_i32$2 = $0;
   HEAP32[(i64toi32_i32$2 + 16 | 0) >> 2] = $7;
   HEAP32[(i64toi32_i32$2 + 20 | 0) >> 2] = i64toi32_i32$0;
   i64toi32_i32$0 = $9$hi;
   HEAP32[(i64toi32_i32$2 + 24 | 0) >> 2] = $9;
   HEAP32[(i64toi32_i32$2 + 28 | 0) >> 2] = i64toi32_i32$0;
   i64toi32_i32$0 = $8$hi;
   HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] = $8;
   HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] = i64toi32_i32$0;
   i64toi32_i32$0 = $10$hi;
   HEAP32[i64toi32_i32$2 >> 2] = $10;
   HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] = i64toi32_i32$0;
  }
  $2 = 4;
  block9 : {
   block8 : {
    if ($5 >>> 0 >= 4 >>> 0) {
     break block8
    }
    i64toi32_i32$0 = 0;
    $7 = 0;
    $7$hi = i64toi32_i32$0;
    $2 = 0;
    break block9;
   }
   i64toi32_i32$1 = $1 + $4 | 0;
   i64toi32_i32$0 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
   i64toi32_i32$2 = 0;
   $7 = i64toi32_i32$0;
   $7$hi = i64toi32_i32$2;
  }
  block10 : {
   if (($2 | 1 | 0) >>> 0 >= $5 >>> 0) {
    break block10
   }
   i64toi32_i32$1 = ($1 + $4 | 0) + $2 | 0;
   i64toi32_i32$2 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
   i64toi32_i32$0 = 0;
   $213$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   $216$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $213$hi;
   i64toi32_i32$1 = i64toi32_i32$2;
   i64toi32_i32$2 = $216$hi;
   i64toi32_i32$3 = $2 << 3 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $81 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $81 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $217$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $7$hi;
   i64toi32_i32$2 = $217$hi;
   i64toi32_i32$0 = $81;
   i64toi32_i32$1 = $7$hi;
   i64toi32_i32$3 = $7;
   i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
   $7 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   $7$hi = i64toi32_i32$1;
   $2 = $2 | 2 | 0;
  }
  block11 : {
   if ($2 >>> 0 >= $5 >>> 0) {
    break block11
   }
   i64toi32_i32$2 = $1 + ($2 + $4 | 0) | 0;
   i64toi32_i32$1 = HEAPU8[i64toi32_i32$2 >> 0] | 0;
   i64toi32_i32$0 = 0;
   $230$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   $233$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $230$hi;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$1 = $233$hi;
   i64toi32_i32$3 = $2 << 3 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $82 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $82 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $234$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $7$hi;
   i64toi32_i32$1 = $234$hi;
   i64toi32_i32$0 = $82;
   i64toi32_i32$2 = $7$hi;
   i64toi32_i32$3 = $7;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $7 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   $7$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $7$hi;
  i64toi32_i32$0 = $0;
  HEAP32[(i64toi32_i32$0 + 48 | 0) >> 2] = $7;
  HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] = i64toi32_i32$2;
  HEAP32[(i64toi32_i32$0 + 60 | 0) >> 2] = $5;
 }
 
 function _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17h6e3bf38268bccdbaE($0) {
  $0 = $0 | 0;
  var $2 = 0, $1 = 0, $11 = 0, $3 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  $2 = HEAP32[$0 >> 2] | 0;
  $11 = $2;
  $2 = $2 << 1 | 0;
  $2 = $2 >>> 0 > 4 >>> 0 ? $2 : 4;
  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hfd2087cfbc25283cE_llvm_309696905035023971($1 + 4 | 0 | 0, $11 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $2 | 0, 4 | 0, 24 | 0);
  block : {
   if ((HEAP32[($1 + 4 | 0) >> 2] | 0 | 0) != (1 | 0)) {
    break block
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($1 + 12 | 0) >> 2] | 0 | 0);
   wasm2js_trap();
  }
  $3 = HEAP32[($1 + 8 | 0) >> 2] | 0;
  HEAP32[$0 >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $3;
  __stack_pointer = $1 + 16 | 0;
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hfd2087cfbc25283cE_llvm_309696905035023971($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $7 = 0, i64toi32_i32$4 = 0, $6 = 0, i64toi32_i32$3 = 0, $17 = 0, $16$hi = 0, $18$hi = 0, $8 = 0, $8$hi = 0, i64toi32_i32$2 = 0;
  $6 = 1;
  $7 = 4;
  block1 : {
   block : {
    i64toi32_i32$0 = 0;
    $16$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $18$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $16$hi;
    i64toi32_i32$1 = $18$hi;
    i64toi32_i32$1 = __wasm_i64_mul((($4 + $5 | 0) + -1 | 0) & (0 - $4 | 0) | 0 | 0, i64toi32_i32$0 | 0, $3 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $8 = i64toi32_i32$1;
    $8$hi = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 32;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $17 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $17 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    if (!$17) {
     break block
    }
    $3 = 0;
    break block1;
   }
   block2 : {
    i64toi32_i32$1 = $8$hi;
    $3 = $8;
    if ($3 >>> 0 <= (-2147483648 - $4 | 0) >>> 0) {
     break block2
    }
    $3 = 0;
    break block1;
   }
   block7 : {
    block6 : {
     block4 : {
      block3 : {
       if (!$1) {
        break block3
       }
       $7 = _RNvCs5QKde7ScR4H_7___rustc14___rust_realloc($2 | 0, Math_imul($5, $1) | 0, $4 | 0, $3 | 0) | 0;
       break block4;
      }
      block5 : {
       if ($3) {
        break block5
       }
       $7 = $4;
       break block6;
      }
      _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
      $7 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($3 | 0, $4 | 0) | 0;
     }
     if ($7) {
      break block6
     }
     HEAP32[($0 + 4 | 0) >> 2] = $4;
     break block7;
    }
    HEAP32[($0 + 4 | 0) >> 2] = $7;
    $6 = 0;
   }
   $7 = 8;
  }
  HEAP32[($0 + $7 | 0) >> 2] = $3;
  HEAP32[$0 >> 2] = $6;
 }
 
 function _ZN5alloc7raw_vec19RawVec$LT$T$C$A$GT$8grow_one17hdc825ddadd76195cE($0) {
  $0 = $0 | 0;
  var $2 = 0, $1 = 0, $11 = 0, $3 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  $2 = HEAP32[$0 >> 2] | 0;
  $11 = $2;
  $2 = $2 << 1 | 0;
  $2 = $2 >>> 0 > 4 >>> 0 ? $2 : 4;
  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hfd2087cfbc25283cE_llvm_309696905035023971($1 + 4 | 0 | 0, $11 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $2 | 0, 4 | 0, 16 | 0);
  block : {
   if ((HEAP32[($1 + 4 | 0) >> 2] | 0 | 0) != (1 | 0)) {
    break block
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($1 + 12 | 0) >> 2] | 0 | 0);
   wasm2js_trap();
  }
  $3 = HEAP32[($1 + 8 | 0) >> 2] | 0;
  HEAP32[$0 >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $3;
  __stack_pointer = $1 + 16 | 0;
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $20 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  block : {
   if ($4) {
    break block
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(0 | 0, 0 | 0);
   wasm2js_trap();
  }
  block1 : {
   $1 = $2 + $1 | 0;
   if ($1 >>> 0 >= $2 >>> 0) {
    break block1
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(0 | 0, 0 | 0);
   wasm2js_trap();
  }
  $2 = HEAP32[$0 >> 2] | 0;
  $20 = $2;
  $2 = $2 << 1 | 0;
  $2 = $1 >>> 0 > $2 >>> 0 ? $1 : $2;
  $1 = ($4 | 0) == (1 | 0) ? 8 : $4 >>> 0 < 1025 >>> 0 ? 4 : 1;
  $2 = $2 >>> 0 > $1 >>> 0 ? $2 : $1;
  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hfd2087cfbc25283cE_llvm_309696905035023971($5 + 4 | 0 | 0, $20 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $2 | 0, $3 | 0, $4 | 0);
  block2 : {
   if ((HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) != (1 | 0)) {
    break block2
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 12 | 0) >> 2] | 0 | 0);
   wasm2js_trap();
  }
  $4 = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[$0 >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $4;
  __stack_pointer = $5 + 16 | 0;
 }
 
 function _ZN79_$LT$hashbrown__raw__RawTable$LT$T$C$A$GT$$u20$as$u20$core__ops__drop__Drop$GT$4drop17h3067237d7422f34eE($0) {
  $0 = $0 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $5 = 0, $5$hi = 0, $3 = 0, $6 = 0, i64toi32_i32$5 = 0, $4 = 0, $7 = 0, $2 = 0, $1 = 0, i64toi32_i32$4 = 0, $8$hi = 0, $8 = 0;
  block : {
   $1 = HEAP32[($0 + 4 | 0) >> 2] | 0;
   if (!$1) {
    break block
   }
   block1 : {
    $2 = HEAP32[($0 + 12 | 0) >> 2] | 0;
    if (!$2) {
     break block1
    }
    $3 = HEAP32[$0 >> 2] | 0;
    $4 = $3 + 8 | 0;
    i64toi32_i32$2 = $3;
    i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$0 = -1;
    i64toi32_i32$3 = -1;
    i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
    i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$2 = -2139062144;
    i64toi32_i32$3 = -2139062144;
    i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$2 | 0;
    $5 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
    $5$hi = i64toi32_i32$2;
    label1 : while (1) {
     block2 : {
      i64toi32_i32$2 = $5$hi;
      i64toi32_i32$0 = $5;
      i64toi32_i32$1 = 0;
      i64toi32_i32$3 = 0;
      if ((i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$1 | 0) | 0) {
       break block2
      }
      label : while (1) {
       $3 = $3 + -192 | 0;
       i64toi32_i32$3 = $4;
       i64toi32_i32$0 = HEAP32[i64toi32_i32$3 >> 2] | 0;
       i64toi32_i32$2 = HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] | 0;
       $5 = i64toi32_i32$0;
       $5$hi = i64toi32_i32$2;
       $6 = i64toi32_i32$3 + 8 | 0;
       $4 = $6;
       i64toi32_i32$3 = i64toi32_i32$0;
       i64toi32_i32$0 = -2139062144;
       i64toi32_i32$1 = -2139062144;
       i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
       $5 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
       $5$hi = i64toi32_i32$0;
       i64toi32_i32$2 = $5;
       i64toi32_i32$3 = -2139062144;
       i64toi32_i32$1 = -2139062144;
       if ((i64toi32_i32$2 | 0) == (i64toi32_i32$1 | 0) & (i64toi32_i32$0 | 0) == (i64toi32_i32$3 | 0) | 0) {
        continue label
       }
       break label;
      };
      i64toi32_i32$2 = i64toi32_i32$0;
      i64toi32_i32$2 = i64toi32_i32$0;
      i64toi32_i32$1 = $5;
      i64toi32_i32$0 = -2139062144;
      i64toi32_i32$3 = -2139062144;
      i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
      $5 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
      $5$hi = i64toi32_i32$0;
      $4 = $6;
     }
     block3 : {
      i64toi32_i32$0 = $5$hi;
      i64toi32_i32$0 = __wasm_ctz_i64($5 | 0, i64toi32_i32$0 | 0) | 0;
      i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
      $6 = $3 + Math_imul(0 - (i64toi32_i32$0 >>> 3 | 0) | 0, 24) | 0;
      $7 = HEAP32[($6 + -24 | 0) >> 2] | 0;
      if (!$7) {
       break block3
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($6 + -20 | 0) >> 2] | 0 | 0, $7 | 0, 1 | 0);
     }
     i64toi32_i32$1 = $5$hi;
     i64toi32_i32$2 = $5;
     i64toi32_i32$0 = -1;
     i64toi32_i32$3 = -1;
     i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
     i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $8 = i64toi32_i32$4;
     $8$hi = i64toi32_i32$5;
     block4 : {
      $7 = HEAP32[($6 + -12 | 0) >> 2] | 0;
      if (!$7) {
       break block4
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($6 + -8 | 0) >> 2] | 0 | 0, $7 | 0, 1 | 0);
     }
     i64toi32_i32$5 = $8$hi;
     i64toi32_i32$5 = $5$hi;
     i64toi32_i32$5 = $8$hi;
     i64toi32_i32$1 = $8;
     i64toi32_i32$2 = $5$hi;
     i64toi32_i32$3 = $5;
     i64toi32_i32$2 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
     $5 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
     $5$hi = i64toi32_i32$2;
     $2 = $2 + -1 | 0;
     if ($2) {
      continue label1
     }
     break label1;
    };
   }
   $4 = Math_imul($1, 24);
   $3 = ($4 + $1 | 0) + 33 | 0;
   if (!$3) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(((HEAP32[$0 >> 2] | 0) - $4 | 0) + -24 | 0 | 0, $3 | 0, 8 | 0);
  }
 }
 
 function _ZN9hashbrown3raw21RawTable$LT$T$C$A$GT$14reserve_rehash17hcd63a91d9d868c85E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $12 = 0, $9 = 0, i64toi32_i32$4 = 0, $11 = 0, $13 = 0, $8 = 0, $11$hi = 0, $7 = 0, $5 = 0, $17 = 0, $10 = 0, $19 = 0, $16 = 0, $14 = 0, $6 = 0, $18 = 0, $15 = 0, $20 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $21 = 0, $67 = 0, $20$hi = 0, $22$hi = 0, $68 = 0, $69 = 0, $70 = 0, $22 = 0, $252 = 0, $257 = 0, $260 = 0, $306 = 0, $312 = 0, $312$hi = 0, $314 = 0, $314$hi = 0, $318 = 0, $324 = 0, $324$hi = 0, $326 = 0, $326$hi = 0, $338 = 0, $344 = 0, $344$hi = 0, $346 = 0, $346$hi = 0, $356 = 0, $468 = 0, $475 = 0, $514 = 0, $519 = 0, $522 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  block7 : {
   block : {
    $6 = HEAP32[($1 + 12 | 0) >> 2] | 0;
    $2 = $6 + $2 | 0;
    if ($2 >>> 0 < $6 >>> 0) {
     break block
    }
    block14 : {
     block1 : {
      $7 = HEAP32[($1 + 4 | 0) >> 2] | 0;
      $8 = $7 + 1 | 0;
      $9 = $8 >>> 3 | 0;
      $10 = $7 >>> 0 < 8 >>> 0 ? $7 : Math_imul($9, 7);
      if ($2 >>> 0 <= ($10 >>> 1 | 0) >>> 0) {
       break block1
      }
      block10 : {
       block9 : {
        block5 : {
         block6 : {
          block3 : {
           block4 : {
            block2 : {
             $9 = $10 + 1 | 0;
             $2 = $9 >>> 0 > $2 >>> 0 ? $9 : $2;
             if ($2 >>> 0 < 15 >>> 0) {
              break block2
             }
             if ($2 >>> 0 > 536870911 >>> 0) {
              break block3
             }
             $2 = (-1 >>> Math_clz32(((($2 << 3 | 0) >>> 0) / (7 >>> 0) | 0) + -1 | 0) | 0) + 1 | 0;
             break block4;
            }
            $2 = $2 >>> 0 < 4 >>> 0 ? 4 : ($2 & 8 | 0) + 8 | 0;
           }
           i64toi32_i32$0 = 0;
           i64toi32_i32$1 = 0;
           i64toi32_i32$1 = __wasm_i64_mul($2 | 0, i64toi32_i32$0 | 0, 24 | 0, i64toi32_i32$1 | 0) | 0;
           i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
           $11 = i64toi32_i32$1;
           $11$hi = i64toi32_i32$0;
           i64toi32_i32$2 = i64toi32_i32$1;
           i64toi32_i32$1 = 0;
           i64toi32_i32$3 = 32;
           i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
           if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
            i64toi32_i32$1 = 0;
            $67 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
           } else {
            i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
            $67 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
           }
           if ($67) {
            break block5
           }
           i64toi32_i32$1 = $11$hi;
           $12 = $11;
           $8 = $2 + 8 | 0;
           $9 = $12 + $8 | 0;
           if ($9 >>> 0 < $12 >>> 0) {
            break block5
           }
           if ($9 >>> 0 > 2147483640 >>> 0) {
            break block5
           }
           _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
           $13 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($9 | 0, 8 | 0) | 0;
           if ($13) {
            break block6
           }
           _ZN9hashbrown3raw11Fallibility9alloc_err17h2c2bc123843b03b6E($5 + 16 | 0 | 0, $4 | 0, 8 | 0, $9 | 0);
           $2 = HEAP32[($5 + 20 | 0) >> 2] | 0;
           $4 = HEAP32[($5 + 16 | 0) >> 2] | 0;
           break block7;
          }
          _ZN9hashbrown3raw11Fallibility17capacity_overflow17h8f507abfa1292136E($5 + 24 | 0 | 0, $4 | 0);
          $2 = HEAP32[($5 + 28 | 0) >> 2] | 0;
          $4 = HEAP32[($5 + 24 | 0) >> 2] | 0;
          break block7;
         }
         $12 = $13 + $12 | 0;
         block8 : {
          if (!$8) {
           break block8
          }
          wasm2js_memory_fill($12, 255, $8);
         }
         $8 = $2 + -1 | 0;
         $14 = $8 >>> 0 < 8 >>> 0 ? $8 : Math_imul($2 >>> 3 | 0, 7);
         if ($6) {
          break block9
         }
         $10 = HEAP32[$1 >> 2] | 0;
         break block10;
        }
        _ZN9hashbrown3raw11Fallibility17capacity_overflow17h8f507abfa1292136E($5 + 8 | 0 | 0, $4 | 0);
        $2 = HEAP32[($5 + 12 | 0) >> 2] | 0;
        $4 = HEAP32[($5 + 8 | 0) >> 2] | 0;
        break block7;
       }
       $15 = $12 + -24 | 0;
       $16 = $12 + 8 | 0;
       $10 = HEAP32[$1 >> 2] | 0;
       $17 = $10 + -24 | 0;
       i64toi32_i32$0 = $10;
       i64toi32_i32$1 = HEAP32[i64toi32_i32$0 >> 2] | 0;
       i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
       i64toi32_i32$0 = i64toi32_i32$1;
       i64toi32_i32$1 = -1;
       i64toi32_i32$3 = -1;
       i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
       i64toi32_i32$2 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
       i64toi32_i32$0 = -2139062144;
       i64toi32_i32$3 = -2139062144;
       i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
       $11 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
       $11$hi = i64toi32_i32$0;
       $2 = 0;
       $18 = $6;
       $4 = $10;
       label2 : while (1) {
        block11 : {
         i64toi32_i32$0 = $11$hi;
         i64toi32_i32$1 = $11;
         i64toi32_i32$2 = 0;
         i64toi32_i32$3 = 0;
         if ((i64toi32_i32$1 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$2 | 0) | 0) {
          break block11
         }
         label : while (1) {
          $2 = $2 + 8 | 0;
          $4 = $4 + 8 | 0;
          i64toi32_i32$3 = $4;
          i64toi32_i32$1 = HEAP32[i64toi32_i32$3 >> 2] | 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] | 0;
          i64toi32_i32$3 = i64toi32_i32$1;
          i64toi32_i32$1 = -2139062144;
          i64toi32_i32$2 = -2139062144;
          i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
          $11 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
          $11$hi = i64toi32_i32$1;
          i64toi32_i32$0 = $11;
          i64toi32_i32$3 = -2139062144;
          i64toi32_i32$2 = -2139062144;
          if ((i64toi32_i32$0 | 0) == (i64toi32_i32$2 | 0) & (i64toi32_i32$1 | 0) == (i64toi32_i32$3 | 0) | 0) {
           continue label
          }
          break label;
         };
         i64toi32_i32$0 = i64toi32_i32$1;
         i64toi32_i32$0 = i64toi32_i32$1;
         i64toi32_i32$2 = $11;
         i64toi32_i32$1 = -2139062144;
         i64toi32_i32$3 = -2139062144;
         i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
         $11 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
         $11$hi = i64toi32_i32$1;
        }
        block12 : {
         i64toi32_i32$1 = $11$hi;
         i64toi32_i32$1 = __wasm_ctz_i64($11 | 0, i64toi32_i32$1 | 0) | 0;
         i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
         $13 = (i64toi32_i32$1 >>> 3 | 0) + $2 | 0;
         i64toi32_i32$2 = _ZN4core4hash11BuildHasher8hash_one17hafe0ce79328045e6E($3 | 0, $17 + Math_imul(0 - $13 | 0, 24) | 0 | 0) | 0;
         i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
         $19 = i64toi32_i32$2;
         $9 = $8 & i64toi32_i32$2 | 0;
         i64toi32_i32$0 = $12 + $9 | 0;
         i64toi32_i32$1 = HEAPU8[i64toi32_i32$0 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
         i64toi32_i32$2 = HEAPU8[(i64toi32_i32$0 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
         i64toi32_i32$0 = i64toi32_i32$1;
         i64toi32_i32$1 = -2139062144;
         i64toi32_i32$3 = -2139062144;
         i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$1 | 0;
         $20 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
         $20$hi = i64toi32_i32$1;
         i64toi32_i32$2 = $20;
         i64toi32_i32$0 = 0;
         i64toi32_i32$3 = 0;
         if ((i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | 0) {
          break block12
         }
         $21 = 8;
         label1 : while (1) {
          $9 = $9 + $21 | 0;
          $21 = $21 + 8 | 0;
          $9 = $9 & $8 | 0;
          i64toi32_i32$3 = $12 + $9 | 0;
          i64toi32_i32$2 = HEAPU8[i64toi32_i32$3 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          i64toi32_i32$1 = HEAPU8[(i64toi32_i32$3 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
          i64toi32_i32$3 = i64toi32_i32$2;
          i64toi32_i32$2 = -2139062144;
          i64toi32_i32$0 = -2139062144;
          i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
          $20 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
          $20$hi = i64toi32_i32$2;
          if (!($20 | i64toi32_i32$2 | 0)) {
           continue label1
          }
          break label1;
         };
        }
        i64toi32_i32$2 = $11$hi;
        i64toi32_i32$1 = $11;
        i64toi32_i32$3 = -1;
        i64toi32_i32$0 = -1;
        i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
        i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
        if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
        }
        $22 = i64toi32_i32$4;
        $22$hi = i64toi32_i32$5;
        block13 : {
         i64toi32_i32$5 = $20$hi;
         i64toi32_i32$5 = __wasm_ctz_i64($20 | 0, i64toi32_i32$5 | 0) | 0;
         i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
         $9 = ((i64toi32_i32$5 >>> 3 | 0) + $9 | 0) & $8 | 0;
         if ((HEAP8[($12 + $9 | 0) >> 0] | 0 | 0) < (0 | 0)) {
          break block13
         }
         i64toi32_i32$2 = $12;
         i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
         i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
         i64toi32_i32$2 = i64toi32_i32$1;
         i64toi32_i32$1 = -2139062144;
         i64toi32_i32$0 = -2139062144;
         i64toi32_i32$1 = i64toi32_i32$5 & i64toi32_i32$1 | 0;
         i64toi32_i32$1 = __wasm_ctz_i64(i64toi32_i32$2 & i64toi32_i32$0 | 0 | 0, i64toi32_i32$1 | 0) | 0;
         i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
         $9 = i64toi32_i32$1 >>> 3 | 0;
        }
        i64toi32_i32$2 = $22$hi;
        i64toi32_i32$2 = $11$hi;
        i64toi32_i32$2 = $22$hi;
        i64toi32_i32$5 = $22;
        i64toi32_i32$1 = $11$hi;
        i64toi32_i32$0 = $11;
        i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$1 | 0;
        $11 = i64toi32_i32$5 & i64toi32_i32$0 | 0;
        $11$hi = i64toi32_i32$1;
        $19 = $19 >>> 25 | 0;
        HEAP8[($12 + $9 | 0) >> 0] = $19;
        HEAP8[($16 + (($9 + -8 | 0) & $8 | 0) | 0) >> 0] = $19;
        $9 = $15 + Math_imul($9, -24) | 0;
        $13 = $17 + Math_imul($13, -24) | 0;
        i64toi32_i32$2 = $13 + 16 | 0;
        i64toi32_i32$1 = HEAPU8[i64toi32_i32$2 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$5 = HEAPU8[(i64toi32_i32$2 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $252 = i64toi32_i32$1;
        i64toi32_i32$1 = $9 + 16 | 0;
        $56 = $252;
        HEAP8[i64toi32_i32$1 >> 0] = $56;
        HEAP8[(i64toi32_i32$1 + 1 | 0) >> 0] = $56 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 2 | 0) >> 0] = $56 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 3 | 0) >> 0] = $56 >>> 24 | 0;
        HEAP8[(i64toi32_i32$1 + 4 | 0) >> 0] = i64toi32_i32$5;
        HEAP8[(i64toi32_i32$1 + 5 | 0) >> 0] = i64toi32_i32$5 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 6 | 0) >> 0] = i64toi32_i32$5 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 7 | 0) >> 0] = i64toi32_i32$5 >>> 24 | 0;
        i64toi32_i32$2 = $13 + 8 | 0;
        i64toi32_i32$5 = HEAPU8[i64toi32_i32$2 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$2 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $257 = i64toi32_i32$5;
        i64toi32_i32$5 = $9 + 8 | 0;
        $57 = $257;
        HEAP8[i64toi32_i32$5 >> 0] = $57;
        HEAP8[(i64toi32_i32$5 + 1 | 0) >> 0] = $57 >>> 8 | 0;
        HEAP8[(i64toi32_i32$5 + 2 | 0) >> 0] = $57 >>> 16 | 0;
        HEAP8[(i64toi32_i32$5 + 3 | 0) >> 0] = $57 >>> 24 | 0;
        HEAP8[(i64toi32_i32$5 + 4 | 0) >> 0] = i64toi32_i32$1;
        HEAP8[(i64toi32_i32$5 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
        HEAP8[(i64toi32_i32$5 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
        HEAP8[(i64toi32_i32$5 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
        i64toi32_i32$2 = $13;
        i64toi32_i32$1 = HEAPU8[i64toi32_i32$2 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$5 = HEAPU8[(i64toi32_i32$2 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$2 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$2 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$2 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $260 = i64toi32_i32$1;
        i64toi32_i32$1 = $9;
        $58 = $260;
        HEAP8[i64toi32_i32$1 >> 0] = $58;
        HEAP8[(i64toi32_i32$1 + 1 | 0) >> 0] = $58 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 2 | 0) >> 0] = $58 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 3 | 0) >> 0] = $58 >>> 24 | 0;
        HEAP8[(i64toi32_i32$1 + 4 | 0) >> 0] = i64toi32_i32$5;
        HEAP8[(i64toi32_i32$1 + 5 | 0) >> 0] = i64toi32_i32$5 >>> 8 | 0;
        HEAP8[(i64toi32_i32$1 + 6 | 0) >> 0] = i64toi32_i32$5 >>> 16 | 0;
        HEAP8[(i64toi32_i32$1 + 7 | 0) >> 0] = i64toi32_i32$5 >>> 24 | 0;
        $18 = $18 + -1 | 0;
        if ($18) {
         continue label2
        }
        break label2;
       };
      }
      HEAP32[($1 + 4 | 0) >> 2] = $8;
      HEAP32[$1 >> 2] = $12;
      HEAP32[($1 + 8 | 0) >> 2] = $14 - $6 | 0;
      $4 = -2147483647;
      if (!$7) {
       break block14
      }
      $2 = (Math_imul($7, 24) + 31 | 0) & -8 | 0;
      $7 = ($7 + $2 | 0) + 9 | 0;
      if (!$7) {
       break block14
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($10 - $2 | 0 | 0, $7 | 0, 8 | 0);
      break block14;
     }
     block15 : {
      if (!$8) {
       break block15
      }
      $4 = HEAP32[$1 >> 2] | 0;
      $2 = 0;
      $9 = $9 + (($8 & 7 | 0 | 0) != (0 | 0)) | 0;
      $13 = $9 & 1 | 0;
      block16 : {
       if (($9 | 0) == (1 | 0)) {
        break block16
       }
       $12 = $9 & 1073741822 | 0;
       $2 = 0;
       label3 : while (1) {
        $9 = $4 + $2 | 0;
        $306 = $9;
        i64toi32_i32$2 = $9;
        i64toi32_i32$5 = HEAP32[i64toi32_i32$2 >> 2] | 0;
        i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
        $11 = i64toi32_i32$5;
        $11$hi = i64toi32_i32$1;
        i64toi32_i32$2 = i64toi32_i32$5;
        i64toi32_i32$5 = -1;
        i64toi32_i32$0 = -1;
        i64toi32_i32$5 = i64toi32_i32$1 ^ i64toi32_i32$5 | 0;
        i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 7;
        i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = 0;
         $68 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
        } else {
         i64toi32_i32$2 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
         $68 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$3 | 0) | 0;
        }
        i64toi32_i32$5 = $68;
        i64toi32_i32$1 = 16843009;
        i64toi32_i32$0 = 16843009;
        i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$1 | 0;
        $312 = i64toi32_i32$5 & i64toi32_i32$0 | 0;
        $312$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $11$hi;
        i64toi32_i32$2 = $11;
        i64toi32_i32$5 = 2139062143;
        i64toi32_i32$0 = 2139062143;
        i64toi32_i32$5 = i64toi32_i32$1 | i64toi32_i32$5 | 0;
        $314 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
        $314$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $312$hi;
        i64toi32_i32$1 = $312;
        i64toi32_i32$2 = $314$hi;
        i64toi32_i32$0 = $314;
        i64toi32_i32$3 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
        if (i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0) {
         i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
        }
        i64toi32_i32$1 = $306;
        HEAP32[i64toi32_i32$1 >> 2] = i64toi32_i32$3;
        HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$4;
        $9 = $9 + 8 | 0;
        $318 = $9;
        i64toi32_i32$5 = $9;
        i64toi32_i32$4 = HEAP32[i64toi32_i32$5 >> 2] | 0;
        i64toi32_i32$1 = HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] | 0;
        $11 = i64toi32_i32$4;
        $11$hi = i64toi32_i32$1;
        i64toi32_i32$5 = i64toi32_i32$4;
        i64toi32_i32$4 = -1;
        i64toi32_i32$0 = -1;
        i64toi32_i32$4 = i64toi32_i32$1 ^ i64toi32_i32$4 | 0;
        i64toi32_i32$1 = i64toi32_i32$5 ^ i64toi32_i32$0 | 0;
        i64toi32_i32$5 = 0;
        i64toi32_i32$0 = 7;
        i64toi32_i32$2 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$5 = 0;
         $69 = i64toi32_i32$4 >>> i64toi32_i32$2 | 0;
        } else {
         i64toi32_i32$5 = i64toi32_i32$4 >>> i64toi32_i32$2 | 0;
         $69 = (((1 << i64toi32_i32$2 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$2 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$2 | 0) | 0;
        }
        i64toi32_i32$4 = $69;
        i64toi32_i32$1 = 16843009;
        i64toi32_i32$0 = 16843009;
        i64toi32_i32$1 = i64toi32_i32$5 & i64toi32_i32$1 | 0;
        $324 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
        $324$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $11$hi;
        i64toi32_i32$5 = $11;
        i64toi32_i32$4 = 2139062143;
        i64toi32_i32$0 = 2139062143;
        i64toi32_i32$4 = i64toi32_i32$1 | i64toi32_i32$4 | 0;
        $326 = i64toi32_i32$5 | i64toi32_i32$0 | 0;
        $326$hi = i64toi32_i32$4;
        i64toi32_i32$4 = $324$hi;
        i64toi32_i32$1 = $324;
        i64toi32_i32$5 = $326$hi;
        i64toi32_i32$0 = $326;
        i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
        i64toi32_i32$3 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
        if (i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0) {
         i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
        }
        i64toi32_i32$1 = $318;
        HEAP32[i64toi32_i32$1 >> 2] = i64toi32_i32$2;
        HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$3;
        $2 = $2 + 16 | 0;
        $12 = $12 + -2 | 0;
        if ($12) {
         continue label3
        }
        break label3;
       };
      }
      block17 : {
       if (!$13) {
        break block17
       }
       $2 = $4 + $2 | 0;
       $338 = $2;
       i64toi32_i32$4 = $2;
       i64toi32_i32$3 = HEAP32[$2 >> 2] | 0;
       i64toi32_i32$1 = HEAP32[($2 + 4 | 0) >> 2] | 0;
       $11 = i64toi32_i32$3;
       $11$hi = i64toi32_i32$1;
       i64toi32_i32$4 = i64toi32_i32$3;
       i64toi32_i32$3 = -1;
       i64toi32_i32$0 = -1;
       i64toi32_i32$3 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
       i64toi32_i32$1 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
       i64toi32_i32$4 = 0;
       i64toi32_i32$0 = 7;
       i64toi32_i32$5 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$4 = 0;
        $70 = i64toi32_i32$3 >>> i64toi32_i32$5 | 0;
       } else {
        i64toi32_i32$4 = i64toi32_i32$3 >>> i64toi32_i32$5 | 0;
        $70 = (((1 << i64toi32_i32$5 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$5 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$5 | 0) | 0;
       }
       i64toi32_i32$3 = $70;
       i64toi32_i32$1 = 16843009;
       i64toi32_i32$0 = 16843009;
       i64toi32_i32$1 = i64toi32_i32$4 & i64toi32_i32$1 | 0;
       $344 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
       $344$hi = i64toi32_i32$1;
       i64toi32_i32$1 = $11$hi;
       i64toi32_i32$4 = $11;
       i64toi32_i32$3 = 2139062143;
       i64toi32_i32$0 = 2139062143;
       i64toi32_i32$3 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
       $346 = i64toi32_i32$4 | i64toi32_i32$0 | 0;
       $346$hi = i64toi32_i32$3;
       i64toi32_i32$3 = $344$hi;
       i64toi32_i32$1 = $344;
       i64toi32_i32$4 = $346$hi;
       i64toi32_i32$0 = $346;
       i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
       i64toi32_i32$2 = i64toi32_i32$3 + i64toi32_i32$4 | 0;
       if (i64toi32_i32$5 >>> 0 < i64toi32_i32$0 >>> 0) {
        i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
       }
       i64toi32_i32$1 = $338;
       HEAP32[i64toi32_i32$1 >> 2] = i64toi32_i32$5;
       HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$2;
      }
      $19 = $4 + 8 | 0;
      block19 : {
       block18 : {
        if ($8 >>> 0 < 8 >>> 0) {
         break block18
        }
        i64toi32_i32$3 = $4;
        i64toi32_i32$2 = HEAPU8[i64toi32_i32$3 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$3 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $356 = i64toi32_i32$2;
        i64toi32_i32$2 = i64toi32_i32$3 + $8 | 0;
        $59 = $356;
        HEAP8[i64toi32_i32$2 >> 0] = $59;
        HEAP8[(i64toi32_i32$2 + 1 | 0) >> 0] = $59 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 2 | 0) >> 0] = $59 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 3 | 0) >> 0] = $59 >>> 24 | 0;
        HEAP8[(i64toi32_i32$2 + 4 | 0) >> 0] = i64toi32_i32$1;
        HEAP8[(i64toi32_i32$2 + 5 | 0) >> 0] = i64toi32_i32$1 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 6 | 0) >> 0] = i64toi32_i32$1 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 7 | 0) >> 0] = i64toi32_i32$1 >>> 24 | 0;
        break block19;
       }
       if (!$8) {
        break block19
       }
       wasm2js_memory_copy($19, $4, $8);
      }
      $15 = $4 + -24 | 0;
      $9 = 0;
      label6 : while (1) {
       $2 = $9;
       $9 = $2 + 1 | 0;
       block20 : {
        $8 = $4 + $2 | 0;
        if ((HEAPU8[$8 >> 0] | 0 | 0) != (128 | 0)) {
         break block20
        }
        $16 = $4 + Math_imul($9, -24) | 0;
        $18 = $15 + Math_imul(0 - $2 | 0, 24) | 0;
        block24 : {
         label5 : while (1) {
          i64toi32_i32$1 = _ZN4core4hash11BuildHasher8hash_one17hafe0ce79328045e6E($3 | 0, $18 | 0) | 0;
          i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
          $17 = i64toi32_i32$1;
          $12 = $7 & i64toi32_i32$1 | 0;
          $13 = $12;
          block21 : {
           i64toi32_i32$3 = $4 + $12 | 0;
           i64toi32_i32$2 = HEAPU8[i64toi32_i32$3 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$1 = HEAPU8[(i64toi32_i32$3 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$3 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$3 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$3 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$3 = i64toi32_i32$2;
           i64toi32_i32$2 = -2139062144;
           i64toi32_i32$0 = -2139062144;
           i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
           $11 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
           $11$hi = i64toi32_i32$2;
           i64toi32_i32$1 = $11;
           i64toi32_i32$3 = 0;
           i64toi32_i32$0 = 0;
           if ((i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) {
            break block21
           }
           $14 = 8;
           $13 = $12;
           label4 : while (1) {
            $13 = $13 + $14 | 0;
            $14 = $14 + 8 | 0;
            $13 = $13 & $7 | 0;
            i64toi32_i32$0 = $4 + $13 | 0;
            i64toi32_i32$1 = HEAPU8[i64toi32_i32$0 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
            i64toi32_i32$2 = HEAPU8[(i64toi32_i32$0 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
            i64toi32_i32$0 = i64toi32_i32$1;
            i64toi32_i32$1 = -2139062144;
            i64toi32_i32$3 = -2139062144;
            i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$1 | 0;
            $11 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
            $11$hi = i64toi32_i32$1;
            if (!($11 | i64toi32_i32$1 | 0)) {
             continue label4
            }
            break label4;
           };
          }
          block22 : {
           i64toi32_i32$1 = $11$hi;
           i64toi32_i32$1 = __wasm_ctz_i64($11 | 0, i64toi32_i32$1 | 0) | 0;
           i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
           $13 = ((i64toi32_i32$1 >>> 3 | 0) + $13 | 0) & $7 | 0;
           if ((HEAP8[($4 + $13 | 0) >> 0] | 0 | 0) < (0 | 0)) {
            break block22
           }
           i64toi32_i32$2 = $4;
           i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
           i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
           i64toi32_i32$2 = i64toi32_i32$0;
           i64toi32_i32$0 = -2139062144;
           i64toi32_i32$3 = -2139062144;
           i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
           i64toi32_i32$0 = __wasm_ctz_i64(i64toi32_i32$2 & i64toi32_i32$3 | 0 | 0, i64toi32_i32$0 | 0) | 0;
           i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
           $13 = i64toi32_i32$0 >>> 3 | 0;
          }
          block23 : {
           if (((($13 - $12 | 0) ^ ($2 - $12 | 0) | 0) & $7 | 0) >>> 0 < 8 >>> 0) {
            break block23
           }
           $12 = $4 + $13 | 0;
           $14 = HEAPU8[$12 >> 0] | 0;
           $17 = $17 >>> 25 | 0;
           HEAP8[$12 >> 0] = $17;
           HEAP8[($19 + (($13 + -8 | 0) & $7 | 0) | 0) >> 0] = $17;
           $12 = $15 + Math_imul($13, -24) | 0;
           if (($14 | 0) == (255 | 0)) {
            break block24
           }
           i64toi32_i32$1 = $16;
           i64toi32_i32$2 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$0 = HEAPU8[(i64toi32_i32$1 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $11 = i64toi32_i32$2;
           $11$hi = i64toi32_i32$0;
           i64toi32_i32$1 = $12;
           i64toi32_i32$0 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$2 = HEAPU8[(i64toi32_i32$1 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $468 = i64toi32_i32$0;
           i64toi32_i32$0 = $16;
           $60 = $468;
           HEAP8[i64toi32_i32$0 >> 0] = $60;
           HEAP8[(i64toi32_i32$0 + 1 | 0) >> 0] = $60 >>> 8 | 0;
           HEAP8[(i64toi32_i32$0 + 2 | 0) >> 0] = $60 >>> 16 | 0;
           HEAP8[(i64toi32_i32$0 + 3 | 0) >> 0] = $60 >>> 24 | 0;
           HEAP8[(i64toi32_i32$0 + 4 | 0) >> 0] = i64toi32_i32$2;
           HEAP8[(i64toi32_i32$0 + 5 | 0) >> 0] = i64toi32_i32$2 >>> 8 | 0;
           HEAP8[(i64toi32_i32$0 + 6 | 0) >> 0] = i64toi32_i32$2 >>> 16 | 0;
           HEAP8[(i64toi32_i32$0 + 7 | 0) >> 0] = i64toi32_i32$2 >>> 24 | 0;
           i64toi32_i32$2 = $11$hi;
           i64toi32_i32$0 = i64toi32_i32$1;
           HEAP8[i64toi32_i32$1 >> 0] = $11;
           HEAP8[(i64toi32_i32$1 + 1 | 0) >> 0] = $11 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 2 | 0) >> 0] = $11 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 3 | 0) >> 0] = $11 >>> 24 | 0;
           HEAP8[(i64toi32_i32$1 + 4 | 0) >> 0] = i64toi32_i32$2;
           HEAP8[(i64toi32_i32$1 + 5 | 0) >> 0] = i64toi32_i32$2 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 6 | 0) >> 0] = i64toi32_i32$2 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 7 | 0) >> 0] = i64toi32_i32$2 >>> 24 | 0;
           i64toi32_i32$2 = HEAPU8[(i64toi32_i32$1 + 8 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 9 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 10 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 11 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$0 = HEAPU8[(i64toi32_i32$1 + 12 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 13 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 14 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 15 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $11 = i64toi32_i32$2;
           $11$hi = i64toi32_i32$0;
           i64toi32_i32$1 = $16;
           i64toi32_i32$0 = HEAPU8[(i64toi32_i32$1 + 8 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 9 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 10 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 11 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           i64toi32_i32$2 = HEAPU8[(i64toi32_i32$1 + 12 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 13 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 14 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 15 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $475 = i64toi32_i32$0;
           i64toi32_i32$0 = $12;
           $61 = $475;
           HEAP8[(i64toi32_i32$0 + 8 | 0) >> 0] = $61;
           HEAP8[(i64toi32_i32$0 + 9 | 0) >> 0] = $61 >>> 8 | 0;
           HEAP8[(i64toi32_i32$0 + 10 | 0) >> 0] = $61 >>> 16 | 0;
           HEAP8[(i64toi32_i32$0 + 11 | 0) >> 0] = $61 >>> 24 | 0;
           HEAP8[(i64toi32_i32$0 + 12 | 0) >> 0] = i64toi32_i32$2;
           HEAP8[(i64toi32_i32$0 + 13 | 0) >> 0] = i64toi32_i32$2 >>> 8 | 0;
           HEAP8[(i64toi32_i32$0 + 14 | 0) >> 0] = i64toi32_i32$2 >>> 16 | 0;
           HEAP8[(i64toi32_i32$0 + 15 | 0) >> 0] = i64toi32_i32$2 >>> 24 | 0;
           i64toi32_i32$2 = $11$hi;
           i64toi32_i32$0 = i64toi32_i32$1;
           HEAP8[(i64toi32_i32$1 + 8 | 0) >> 0] = $11;
           HEAP8[(i64toi32_i32$1 + 9 | 0) >> 0] = $11 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 10 | 0) >> 0] = $11 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 11 | 0) >> 0] = $11 >>> 24 | 0;
           HEAP8[(i64toi32_i32$1 + 12 | 0) >> 0] = i64toi32_i32$2;
           HEAP8[(i64toi32_i32$1 + 13 | 0) >> 0] = i64toi32_i32$2 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 14 | 0) >> 0] = i64toi32_i32$2 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 15 | 0) >> 0] = i64toi32_i32$2 >>> 24 | 0;
           $13 = HEAPU8[(i64toi32_i32$1 + 16 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 17 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 18 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 19 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $62 = HEAPU8[($12 + 16 | 0) >> 0] | 0 | ((HEAPU8[($12 + 17 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($12 + 18 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($12 + 19 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           HEAP8[(i64toi32_i32$1 + 16 | 0) >> 0] = $62;
           HEAP8[(i64toi32_i32$1 + 17 | 0) >> 0] = $62 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 18 | 0) >> 0] = $62 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 19 | 0) >> 0] = $62 >>> 24 | 0;
           $17 = HEAPU8[($12 + 20 | 0) >> 0] | 0 | ((HEAPU8[($12 + 21 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($12 + 22 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($12 + 23 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           $63 = HEAPU8[(i64toi32_i32$1 + 20 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 21 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 22 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 23 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
           HEAP8[($12 + 20 | 0) >> 0] = $63;
           HEAP8[($12 + 21 | 0) >> 0] = $63 >>> 8 | 0;
           HEAP8[($12 + 22 | 0) >> 0] = $63 >>> 16 | 0;
           HEAP8[($12 + 23 | 0) >> 0] = $63 >>> 24 | 0;
           HEAP8[(i64toi32_i32$1 + 20 | 0) >> 0] = $17;
           HEAP8[(i64toi32_i32$1 + 21 | 0) >> 0] = $17 >>> 8 | 0;
           HEAP8[(i64toi32_i32$1 + 22 | 0) >> 0] = $17 >>> 16 | 0;
           HEAP8[(i64toi32_i32$1 + 23 | 0) >> 0] = $17 >>> 24 | 0;
           HEAP8[($12 + 16 | 0) >> 0] = $13;
           HEAP8[($12 + 17 | 0) >> 0] = $13 >>> 8 | 0;
           HEAP8[($12 + 18 | 0) >> 0] = $13 >>> 16 | 0;
           HEAP8[($12 + 19 | 0) >> 0] = $13 >>> 24 | 0;
           continue label5;
          }
          break label5;
         };
         $12 = $17 >>> 25 | 0;
         HEAP8[$8 >> 0] = $12;
         HEAP8[($19 + (($2 + -8 | 0) & $7 | 0) | 0) >> 0] = $12;
         break block20;
        }
        HEAP8[$8 >> 0] = 255;
        HEAP8[($19 + (($2 + -8 | 0) & $7 | 0) | 0) >> 0] = 255;
        i64toi32_i32$1 = $16 + 16 | 0;
        i64toi32_i32$2 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$0 = HEAPU8[(i64toi32_i32$1 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $514 = i64toi32_i32$2;
        i64toi32_i32$2 = $12 + 16 | 0;
        $64 = $514;
        HEAP8[i64toi32_i32$2 >> 0] = $64;
        HEAP8[(i64toi32_i32$2 + 1 | 0) >> 0] = $64 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 2 | 0) >> 0] = $64 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 3 | 0) >> 0] = $64 >>> 24 | 0;
        HEAP8[(i64toi32_i32$2 + 4 | 0) >> 0] = i64toi32_i32$0;
        HEAP8[(i64toi32_i32$2 + 5 | 0) >> 0] = i64toi32_i32$0 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 6 | 0) >> 0] = i64toi32_i32$0 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 7 | 0) >> 0] = i64toi32_i32$0 >>> 24 | 0;
        i64toi32_i32$1 = $16 + 8 | 0;
        i64toi32_i32$0 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$2 = HEAPU8[(i64toi32_i32$1 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $519 = i64toi32_i32$0;
        i64toi32_i32$0 = $12 + 8 | 0;
        $65 = $519;
        HEAP8[i64toi32_i32$0 >> 0] = $65;
        HEAP8[(i64toi32_i32$0 + 1 | 0) >> 0] = $65 >>> 8 | 0;
        HEAP8[(i64toi32_i32$0 + 2 | 0) >> 0] = $65 >>> 16 | 0;
        HEAP8[(i64toi32_i32$0 + 3 | 0) >> 0] = $65 >>> 24 | 0;
        HEAP8[(i64toi32_i32$0 + 4 | 0) >> 0] = i64toi32_i32$2;
        HEAP8[(i64toi32_i32$0 + 5 | 0) >> 0] = i64toi32_i32$2 >>> 8 | 0;
        HEAP8[(i64toi32_i32$0 + 6 | 0) >> 0] = i64toi32_i32$2 >>> 16 | 0;
        HEAP8[(i64toi32_i32$0 + 7 | 0) >> 0] = i64toi32_i32$2 >>> 24 | 0;
        i64toi32_i32$1 = $16;
        i64toi32_i32$2 = HEAPU8[i64toi32_i32$1 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$0 = HEAPU8[(i64toi32_i32$1 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$1 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$1 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$1 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $522 = i64toi32_i32$2;
        i64toi32_i32$2 = $12;
        $66 = $522;
        HEAP8[i64toi32_i32$2 >> 0] = $66;
        HEAP8[(i64toi32_i32$2 + 1 | 0) >> 0] = $66 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 2 | 0) >> 0] = $66 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 3 | 0) >> 0] = $66 >>> 24 | 0;
        HEAP8[(i64toi32_i32$2 + 4 | 0) >> 0] = i64toi32_i32$0;
        HEAP8[(i64toi32_i32$2 + 5 | 0) >> 0] = i64toi32_i32$0 >>> 8 | 0;
        HEAP8[(i64toi32_i32$2 + 6 | 0) >> 0] = i64toi32_i32$0 >>> 16 | 0;
        HEAP8[(i64toi32_i32$2 + 7 | 0) >> 0] = i64toi32_i32$0 >>> 24 | 0;
       }
       if (($2 | 0) != ($7 | 0)) {
        continue label6
       }
       break label6;
      };
     }
     HEAP32[($1 + 8 | 0) >> 2] = $10 - $6 | 0;
     $4 = -2147483647;
    }
    break block7;
   }
   _ZN9hashbrown3raw11Fallibility17capacity_overflow17h8f507abfa1292136E($5 | 0, $4 | 0);
   $2 = HEAP32[($5 + 4 | 0) >> 2] | 0;
   $4 = HEAP32[$5 >> 2] | 0;
  }
  HEAP32[($0 + 4 | 0) >> 2] = $2;
  HEAP32[$0 >> 2] = $4;
  __stack_pointer = $5 + 32 | 0;
 }
 
 function _ZN111_$LT$alloc__vec__Vec$LT$T$GT$$u20$as$u20$alloc__vec__spec_from_iter_nested__SpecFromIterNested$LT$T$C$I$GT$$GT$9from_iter17h943992d3e14995e3E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $5 = 0, $3 = 0, $6 = 0, $7 = 0, $8 = 0, i64toi32_i32$0 = 0, $9 = 0, i64toi32_i32$1 = 0, $183 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  block6 : {
   block15 : {
    block : {
     if (($1 | 0) == ($2 | 0)) {
      break block
     }
     block2 : {
      block1 : {
       $4 = HEAP8[$1 >> 0] | 0;
       if (($4 | 0) <= (-1 | 0)) {
        break block1
       }
       $1 = $1 + 1 | 0;
       $5 = $4 & 255 | 0;
       break block2;
      }
      $6 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
      $5 = $4 & 31 | 0;
      block3 : {
       if ($4 >>> 0 > -33 >>> 0) {
        break block3
       }
       $5 = $5 << 6 | 0 | $6 | 0;
       $1 = $1 + 2 | 0;
       break block2;
      }
      $6 = $6 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
      block4 : {
       if ($4 >>> 0 >= -16 >>> 0) {
        break block4
       }
       $5 = $6 | ($5 << 12 | 0) | 0;
       $1 = $1 + 3 | 0;
       break block2;
      }
      $5 = $6 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($5 << 18 | 0) & 1835008 | 0) | 0;
      if (($5 | 0) == (1114112 | 0)) {
       break block
      }
      $1 = $1 + 4 | 0;
     }
     $6 = 0;
     block5 : {
      $4 = $2 - $1 | 0;
      $4 = ($4 >>> 2 | 0) + (($4 & 3 | 0 | 0) != (0 | 0)) | 0;
      if ($4 >>> 0 <= 1073741822 >>> 0) {
       break block5
      }
      break block6;
     }
     $7 = ($4 >>> 0 > 3 >>> 0 ? $4 : 3) + 1 | 0;
     $4 = $7 << 2 | 0;
     if ($4 >>> 0 > 2147483644 >>> 0) {
      break block6
     }
     block8 : {
      block7 : {
       if ($4) {
        break block7
       }
       $8 = 4;
       $7 = 0;
       break block8;
      }
      _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
      $6 = 4;
      $8 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($4 | 0, 4 | 0) | 0;
      if (!$8) {
       break block6
      }
     }
     HEAP32[$8 >> 2] = $5;
     HEAP32[($3 + 12 | 0) >> 2] = 1;
     HEAP32[($3 + 8 | 0) >> 2] = $8;
     HEAP32[($3 + 4 | 0) >> 2] = $7;
     block9 : {
      if (($1 | 0) == ($2 | 0)) {
       break block9
      }
      $6 = 4;
      $4 = 1;
      label : while (1) {
       block11 : {
        block10 : {
         $5 = HEAP8[$1 >> 0] | 0;
         if (($5 | 0) <= (-1 | 0)) {
          break block10
         }
         $1 = $1 + 1 | 0;
         $5 = $5 & 255 | 0;
         break block11;
        }
        $7 = (HEAPU8[($1 + 1 | 0) >> 0] | 0) & 63 | 0;
        $9 = $5 & 31 | 0;
        block12 : {
         if ($5 >>> 0 > -33 >>> 0) {
          break block12
         }
         $5 = $9 << 6 | 0 | $7 | 0;
         $1 = $1 + 2 | 0;
         break block11;
        }
        $7 = $7 << 6 | 0 | ((HEAPU8[($1 + 2 | 0) >> 0] | 0) & 63 | 0) | 0;
        block13 : {
         if ($5 >>> 0 >= -16 >>> 0) {
          break block13
         }
         $5 = $7 | ($9 << 12 | 0) | 0;
         $1 = $1 + 3 | 0;
         break block11;
        }
        $5 = $7 << 6 | 0 | ((HEAPU8[($1 + 3 | 0) >> 0] | 0) & 63 | 0) | 0 | (($9 << 18 | 0) & 1835008 | 0) | 0;
        if (($5 | 0) == (1114112 | 0)) {
         break block9
        }
        $1 = $1 + 4 | 0;
       }
       block14 : {
        if (($4 | 0) != (HEAP32[($3 + 4 | 0) >> 2] | 0 | 0)) {
         break block14
        }
        $8 = $2 - $1 | 0;
        _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hf8a4e0fe39dbf7bbE($3 + 4 | 0 | 0, $4 | 0, (($8 >>> 2 | 0) + (($8 & 3 | 0 | 0) != (0 | 0)) | 0) + 1 | 0 | 0, 4 | 0, 4 | 0);
        $8 = HEAP32[($3 + 8 | 0) >> 2] | 0;
       }
       HEAP32[($8 + $6 | 0) >> 2] = $5;
       $4 = $4 + 1 | 0;
       HEAP32[($3 + 12 | 0) >> 2] = $4;
       $6 = $6 + 4 | 0;
       if (($1 | 0) != ($2 | 0)) {
        continue label
       }
       break label;
      };
     }
     i64toi32_i32$0 = HEAP32[($3 + 4 | 0) >> 2] | 0;
     i64toi32_i32$1 = HEAP32[($3 + 8 | 0) >> 2] | 0;
     $183 = i64toi32_i32$0;
     i64toi32_i32$0 = $0;
     HEAP32[i64toi32_i32$0 >> 2] = $183;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = HEAP32[(($3 + 4 | 0) + 8 | 0) >> 2] | 0;
     break block15;
    }
    HEAP32[($0 + 8 | 0) >> 2] = 0;
    i64toi32_i32$0 = $0;
    i64toi32_i32$1 = 4;
    HEAP32[i64toi32_i32$0 >> 2] = 0;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
   }
   __stack_pointer = $3 + 16 | 0;
   return;
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($6 | 0, $4 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std3sys12thread_local10no_threads20LazyStorage$LT$T$GT$10initialize17h856bdfec157899d7E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $2 = 0, $4 = 0, $4$hi = 0, $5 = 0, $5$hi = 0, $3 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  block1 : {
   block : {
    if (!$1) {
     break block
    }
    $3 = HEAP32[$1 >> 2] | 0;
    i64toi32_i32$1 = $1;
    i64toi32_i32$0 = 0;
    HEAP32[i64toi32_i32$1 >> 2] = 0;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    if (!($3 & 1 | 0)) {
     break block
    }
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] | 0;
    $4 = i64toi32_i32$0;
    $4$hi = i64toi32_i32$1;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
    $5 = i64toi32_i32$1;
    $5$hi = i64toi32_i32$0;
    break block1;
   }
   _ZN3std3sys6random11unsupported19hashmap_random_keys17h8ce533668958160aE($2 | 0);
   i64toi32_i32$2 = $2;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
   $4 = i64toi32_i32$0;
   $4$hi = i64toi32_i32$1;
   i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
   $5 = i64toi32_i32$1;
   $5$hi = i64toi32_i32$0;
  }
  block2 : {
   if ((HEAPU8[($0 + 16 | 0) >> 0] | 0 | 0) != (2 | 0)) {
    break block2
   }
   _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050152 | 0, 125 | 0, 1050216 | 0);
   wasm2js_trap();
  }
  HEAP8[($0 + 16 | 0) >> 0] = 1;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$1 = $0;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = $4;
  HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  HEAP32[i64toi32_i32$1 >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  __stack_pointer = $2 + 16 | 0;
  return i64toi32_i32$1 | 0;
 }
 
 function _ZN3std3sys4sync4once10no_threads4Once4call17hd163639b59d7fa10E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $25 = 0, $28 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  block4 : {
   block5 : {
    block2 : {
     switch (HEAPU8[$0 >> 0] | 0 | 0) {
     default:
      HEAP8[$0 >> 0] = 2;
      $1 = HEAP32[$2 >> 2] | 0;
      $2 = HEAP32[$1 >> 2] | 0;
      HEAP32[$1 >> 2] = 0;
      if (!$2) {
       break block4
      }
      FUNCTION_TABLE[HEAP32[$2 >> 2] | 0 | 0]($4);
      i64toi32_i32$2 = $4 + 8 | 0;
      i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
      $25 = i64toi32_i32$0;
      i64toi32_i32$0 = $2 + 8 | 0;
      HEAP32[i64toi32_i32$0 >> 2] = $25;
      HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
      i64toi32_i32$2 = $4;
      i64toi32_i32$1 = HEAP32[$4 >> 2] | 0;
      i64toi32_i32$0 = HEAP32[($4 + 4 | 0) >> 2] | 0;
      $28 = i64toi32_i32$1;
      i64toi32_i32$1 = $2;
      HEAP32[$2 >> 2] = $28;
      HEAP32[($2 + 4 | 0) >> 2] = i64toi32_i32$0;
      HEAP8[$0 >> 0] = 3;
     case 3:
      __stack_pointer = $4 + 16 | 0;
      return;
     case 1:
      if (!$1) {
       break block5
      }
      HEAP8[$0 >> 0] = 2;
      $0 = HEAP32[$2 >> 2] | 0;
      $4 = HEAP32[$0 >> 2] | 0;
      HEAP32[$0 >> 2] = 0;
      if (!$4) {
       break block4
      }
      _ZN3std4sync9lazy_lock14panic_poisoned17h955bb12d72c833a2E();
      wasm2js_trap();
     case 2:
      break block2;
     };
    }
    _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050274 | 0, 113 | 0, $3 | 0);
    wasm2js_trap();
   }
   _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050232 | 0, 85 | 0, $3 | 0);
   wasm2js_trap();
  }
  _ZN4core6option13unwrap_failed17h8ebba99799176358E(1050332 | 0);
  wasm2js_trap();
 }
 
 function _ZN9hashbrown3map28HashMap$LT$K$C$V$C$S$C$A$GT$6insert17h40da1956ffd7c5e2E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var i64toi32_i32$5 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, $6 = 0, $6$hi = 0, $5 = 0, $8 = 0, $4 = 0, $17 = 0, $7 = 0, $12 = 0, $13 = 0, $14 = 0, $15$hi = 0, $16 = 0, $39 = 0, $9 = 0, $10$hi = 0, $15 = 0, $40 = 0, $9$hi = 0, $41 = 0, $10 = 0, $11 = 0, $56 = 0, $56$hi = 0, $58$hi = 0, $88$hi = 0, $108 = 0, $108$hi = 0, $110$hi = 0, $179 = 0, $183 = 0, $189 = 0, $197 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  $5 = $1 + 16 | 0;
  i64toi32_i32$0 = _ZN4core4hash11BuildHasher8hash_one17hafe0ce79328045e6E($5 | 0, $2 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $6 = i64toi32_i32$0;
  $6$hi = i64toi32_i32$1;
  block : {
   if (HEAP32[($1 + 8 | 0) >> 2] | 0) {
    break block
   }
   _ZN9hashbrown3raw21RawTable$LT$T$C$A$GT$14reserve_rehash17hcd63a91d9d868c85E($4 | 0, $1 | 0, 1 | 0, $5 | 0, 1 | 0);
  }
  $7 = HEAP32[($1 + 4 | 0) >> 2] | 0;
  i64toi32_i32$1 = $6$hi;
  $8 = $7 & $6 | 0;
  i64toi32_i32$2 = $6;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 25;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = 0;
   $39 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$0 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $39 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $9 = $39;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$1 = $9;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 127;
  i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$2 | 0;
  $41 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
  i64toi32_i32$1 = 16843009;
  i64toi32_i32$1 = __wasm_i64_mul($41 | 0, i64toi32_i32$2 | 0, 16843009 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
  $10 = i64toi32_i32$1;
  $10$hi = i64toi32_i32$2;
  $11 = HEAP32[($2 + 4 | 0) >> 2] | 0;
  $12 = HEAP32[($2 + 8 | 0) >> 2] | 0;
  $5 = HEAP32[$1 >> 2] | 0;
  $13 = 0;
  $14 = 0;
  label1 : while (1) {
   block7 : {
    block5 : {
     block9 : {
      block3 : {
       block1 : {
        i64toi32_i32$0 = $5 + $8 | 0;
        i64toi32_i32$2 = HEAPU8[i64toi32_i32$0 >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        i64toi32_i32$1 = HEAPU8[(i64toi32_i32$0 + 4 | 0) >> 0] | 0 | ((HEAPU8[(i64toi32_i32$0 + 5 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[(i64toi32_i32$0 + 6 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[(i64toi32_i32$0 + 7 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
        $15 = i64toi32_i32$2;
        $15$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $10$hi;
        i64toi32_i32$1 = $15$hi;
        i64toi32_i32$0 = i64toi32_i32$2;
        i64toi32_i32$2 = $10$hi;
        i64toi32_i32$3 = $10;
        i64toi32_i32$2 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
        $6 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
        $6$hi = i64toi32_i32$2;
        i64toi32_i32$1 = $6;
        i64toi32_i32$0 = -1;
        i64toi32_i32$3 = -1;
        i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
        $56 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
        $56$hi = i64toi32_i32$0;
        i64toi32_i32$0 = i64toi32_i32$2;
        i64toi32_i32$0 = i64toi32_i32$2;
        i64toi32_i32$2 = i64toi32_i32$1;
        i64toi32_i32$1 = -16843010;
        i64toi32_i32$3 = -16843009;
        i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
        i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
        if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
        }
        $58$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $56$hi;
        i64toi32_i32$0 = $56;
        i64toi32_i32$2 = $58$hi;
        i64toi32_i32$3 = i64toi32_i32$4;
        i64toi32_i32$2 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
        i64toi32_i32$5 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
        i64toi32_i32$0 = -2139062144;
        i64toi32_i32$3 = -2139062144;
        i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
        $6 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
        $6$hi = i64toi32_i32$0;
        if (!($6 | i64toi32_i32$0 | 0)) {
         break block1
        }
        label : while (1) {
         block2 : {
          i64toi32_i32$0 = $6$hi;
          i64toi32_i32$0 = __wasm_ctz_i64($6 | 0, i64toi32_i32$0 | 0) | 0;
          i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
          $16 = $5 + Math_imul(0 - (((i64toi32_i32$0 >>> 3 | 0) + $8 | 0) & $7 | 0) | 0, 24) | 0;
          if (($12 | 0) != (HEAP32[($16 + -16 | 0) >> 2] | 0 | 0)) {
           break block2
          }
          if (!(memcmp($11 | 0, HEAP32[($16 + -20 | 0) >> 2] | 0 | 0, $12 | 0) | 0)) {
           break block3
          }
         }
         i64toi32_i32$5 = $6$hi;
         i64toi32_i32$2 = $6;
         i64toi32_i32$0 = -1;
         i64toi32_i32$3 = -1;
         i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
         i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
         if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
          i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
         }
         $88$hi = i64toi32_i32$4;
         i64toi32_i32$4 = $6$hi;
         i64toi32_i32$4 = $88$hi;
         i64toi32_i32$5 = i64toi32_i32$1;
         i64toi32_i32$2 = $6$hi;
         i64toi32_i32$3 = $6;
         i64toi32_i32$2 = i64toi32_i32$4 & i64toi32_i32$2 | 0;
         $6 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
         $6$hi = i64toi32_i32$2;
         if (!!($6 | i64toi32_i32$2 | 0)) {
          continue label
         }
         break label;
        };
       }
       i64toi32_i32$2 = $15$hi;
       i64toi32_i32$4 = $15;
       i64toi32_i32$5 = -2139062144;
       i64toi32_i32$3 = -2139062144;
       i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
       $6 = i64toi32_i32$4 & i64toi32_i32$3 | 0;
       $6$hi = i64toi32_i32$5;
       block4 : {
        if (($13 | 0) == (1 | 0)) {
         break block4
        }
        if (!($6 | i64toi32_i32$5 | 0)) {
         break block5
        }
        i64toi32_i32$5 = __wasm_ctz_i64($6 | 0, i64toi32_i32$5 | 0) | 0;
        i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
        $17 = ((i64toi32_i32$5 >>> 3 | 0) + $8 | 0) & $7 | 0;
       }
       block6 : {
        i64toi32_i32$4 = $6$hi;
        $108 = $6;
        $108$hi = i64toi32_i32$4;
        i64toi32_i32$4 = $15$hi;
        i64toi32_i32$2 = $15;
        i64toi32_i32$5 = 0;
        i64toi32_i32$3 = 1;
        i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
         $40 = 0;
        } else {
         i64toi32_i32$5 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$0 | 0) | 0;
         $40 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
        }
        $110$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $108$hi;
        i64toi32_i32$4 = $108;
        i64toi32_i32$2 = $110$hi;
        i64toi32_i32$3 = $40;
        i64toi32_i32$2 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
        i64toi32_i32$5 = i64toi32_i32$4 & i64toi32_i32$3 | 0;
        i64toi32_i32$4 = 0;
        i64toi32_i32$3 = 0;
        if ((i64toi32_i32$5 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$4 | 0) | 0) {
         break block6
        }
        $13 = 1;
        break block7;
       }
       block8 : {
        $8 = HEAP8[($5 + $17 | 0) >> 0] | 0;
        if (($8 | 0) < (0 | 0)) {
         break block8
        }
        i64toi32_i32$3 = $5;
        i64toi32_i32$5 = HEAP32[i64toi32_i32$3 >> 2] | 0;
        i64toi32_i32$2 = HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] | 0;
        i64toi32_i32$3 = i64toi32_i32$5;
        i64toi32_i32$5 = -2139062144;
        i64toi32_i32$4 = -2139062144;
        i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
        i64toi32_i32$5 = __wasm_ctz_i64(i64toi32_i32$3 & i64toi32_i32$4 | 0 | 0, i64toi32_i32$5 | 0) | 0;
        i64toi32_i32$3 = i64toi32_i32$HIGH_BITS;
        $17 = i64toi32_i32$5 >>> 3 | 0;
        $8 = HEAPU8[($5 + $17 | 0) >> 0] | 0;
       }
       $12 = HEAP32[($2 + 8 | 0) >> 2] | 0;
       i64toi32_i32$2 = $2;
       i64toi32_i32$3 = HEAP32[i64toi32_i32$2 >> 2] | 0;
       i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
       $6 = i64toi32_i32$3;
       $6$hi = i64toi32_i32$5;
       i64toi32_i32$5 = $9$hi;
       $2 = $9 & 127 | 0;
       HEAP8[($5 + $17 | 0) >> 0] = $2;
       HEAP8[(($5 + (($17 + -8 | 0) & $7 | 0) | 0) + 8 | 0) >> 0] = $2;
       $2 = ($4 + 8 | 0) + 8 | 0;
       HEAP32[$2 >> 2] = $12;
       HEAP32[($4 + 28 | 0) >> 2] = HEAP32[($3 + 8 | 0) >> 2] | 0;
       HEAP32[($1 + 8 | 0) >> 2] = (HEAP32[($1 + 8 | 0) >> 2] | 0) - ($8 & 1 | 0) | 0;
       HEAP32[($1 + 12 | 0) >> 2] = (HEAP32[($1 + 12 | 0) >> 2] | 0) + 1 | 0;
       $1 = ($5 + Math_imul(0 - $17 | 0, 24) | 0) + -24 | 0;
       i64toi32_i32$5 = $6$hi;
       i64toi32_i32$3 = $1;
       HEAP32[i64toi32_i32$3 >> 2] = $6;
       HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] = i64toi32_i32$5;
       i64toi32_i32$2 = $3;
       i64toi32_i32$5 = HEAP32[i64toi32_i32$2 >> 2] | 0;
       i64toi32_i32$3 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
       $179 = i64toi32_i32$5;
       i64toi32_i32$5 = $4;
       HEAP32[(i64toi32_i32$5 + 20 | 0) >> 2] = $179;
       HEAP32[(i64toi32_i32$5 + 24 | 0) >> 2] = i64toi32_i32$3;
       i64toi32_i32$2 = $2;
       i64toi32_i32$3 = HEAP32[i64toi32_i32$2 >> 2] | 0;
       i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
       $183 = i64toi32_i32$3;
       i64toi32_i32$3 = $1 + 8 | 0;
       HEAP32[i64toi32_i32$3 >> 2] = $183;
       HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] = i64toi32_i32$5;
       i64toi32_i32$2 = ($4 + 8 | 0) + 16 | 0;
       i64toi32_i32$5 = HEAP32[i64toi32_i32$2 >> 2] | 0;
       i64toi32_i32$3 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
       $189 = i64toi32_i32$5;
       i64toi32_i32$5 = $1 + 16 | 0;
       HEAP32[i64toi32_i32$5 >> 2] = $189;
       HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$3;
       HEAP32[$0 >> 2] = -2147483648;
       break block9;
      }
      $1 = $16 + -12 | 0;
      i64toi32_i32$2 = $1;
      i64toi32_i32$3 = HEAP32[i64toi32_i32$2 >> 2] | 0;
      i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
      $6 = i64toi32_i32$3;
      $6$hi = i64toi32_i32$5;
      i64toi32_i32$2 = $3;
      i64toi32_i32$5 = HEAP32[i64toi32_i32$2 >> 2] | 0;
      i64toi32_i32$3 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
      $197 = i64toi32_i32$5;
      i64toi32_i32$5 = $1;
      HEAP32[i64toi32_i32$5 >> 2] = $197;
      HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$3;
      $1 = i64toi32_i32$5 + 8 | 0;
      $5 = HEAP32[$1 >> 2] | 0;
      HEAP32[$1 >> 2] = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
      i64toi32_i32$3 = $6$hi;
      i64toi32_i32$5 = $0;
      HEAP32[i64toi32_i32$5 >> 2] = $6;
      HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$3;
      HEAP32[(i64toi32_i32$5 + 8 | 0) >> 2] = $5;
      $1 = HEAP32[$2 >> 2] | 0;
      if (!$1) {
       break block9
      }
      _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($2 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
     }
     __stack_pointer = $4 + 32 | 0;
     return;
    }
    $13 = 0;
   }
   $14 = $14 + 8 | 0;
   $8 = ($14 + $8 | 0) & $7 | 0;
   continue label1;
  };
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _RNvCs5QKde7ScR4H_7___rustc11___rdl_alloc($0 | 0, $1 | 0) | 0 | 0;
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  _RNvCs5QKde7ScR4H_7___rustc13___rdl_dealloc($0 | 0, $1 | 0, $2 | 0);
  return;
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc14___rust_realloc($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  return _RNvCs5QKde7ScR4H_7___rustc13___rdl_realloc($0 | 0, $1 | 0, $2 | 0, $3 | 0) | 0 | 0;
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2() {
  
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc18___rust_start_panic($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0;
  _RNvCs5QKde7ScR4H_7___rustc12___rust_abort();
  wasm2js_trap();
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc10rust_panic($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  _RNvCs5QKde7ScR4H_7___rustc18___rust_start_panic($0 | 0, $1 | 0) | 0;
  wasm2js_trap();
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc11___rdl_alloc($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if ($1 >>> 0 < 9 >>> 0) {
    break block
   }
   return _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$8memalign17haf349dd76c9a5091E($1 | 0, $0 | 0) | 0 | 0;
  }
  return _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$6malloc17h56d0ddc1cdd2a835E($0 | 0) | 0 | 0;
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$8memalign17haf349dd76c9a5091E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $4 = 0, $3 = 0, $5 = 0, $6 = 0;
  $2 = 0;
  block : {
   $0 = $0 >>> 0 > 16 >>> 0 ? $0 : 16;
   if ($1 >>> 0 >= (-65587 - $0 | 0) >>> 0) {
    break block
   }
   $3 = $1 >>> 0 < 11 >>> 0 ? 16 : ($1 + 11 | 0) & -8 | 0;
   $1 = _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$6malloc17h56d0ddc1cdd2a835E(($0 + $3 | 0) + 12 | 0 | 0) | 0;
   if (!$1) {
    break block
   }
   $2 = $1 + -8 | 0;
   block2 : {
    block1 : {
     $4 = $0 + -1 | 0;
     if ($4 & $1 | 0) {
      break block1
     }
     $0 = $2;
     break block2;
    }
    $5 = $1 + -4 | 0;
    $6 = HEAP32[$5 >> 2] | 0;
    $1 = (($4 + $1 | 0) & (0 - $0 | 0) | 0) + -8 | 0;
    $0 = $1 + (($1 - $2 | 0) >>> 0 > 16 >>> 0 ? 0 : $0) | 0;
    $1 = $0 - $2 | 0;
    $4 = ($6 & -8 | 0) - $1 | 0;
    block3 : {
     if (!($6 & 3 | 0)) {
      break block3
     }
     HEAP32[($0 + 4 | 0) >> 2] = $4 | ((HEAP32[($0 + 4 | 0) >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
     $4 = $0 + $4 | 0;
     HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0 | 1 | 0;
     HEAP32[$5 >> 2] = $1 | ((HEAP32[$5 >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
     $4 = $2 + $1 | 0;
     HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0 | 1 | 0;
     _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$13dispose_chunk17hae588b8b17945682E($2 | 0, $1 | 0);
     break block2;
    }
    $2 = HEAP32[$2 >> 2] | 0;
    HEAP32[($0 + 4 | 0) >> 2] = $4;
    HEAP32[$0 >> 2] = $2 + $1 | 0;
   }
   block4 : {
    $1 = HEAP32[($0 + 4 | 0) >> 2] | 0;
    if (!($1 & 3 | 0)) {
     break block4
    }
    $2 = $1 & -8 | 0;
    if ($2 >>> 0 <= ($3 + 16 | 0) >>> 0) {
     break block4
    }
    HEAP32[($0 + 4 | 0) >> 2] = $3 | ($1 & 1 | 0) | 0 | 2 | 0;
    $1 = $0 + $3 | 0;
    $3 = $2 - $3 | 0;
    HEAP32[($1 + 4 | 0) >> 2] = $3 | 3 | 0;
    $2 = $0 + $2 | 0;
    HEAP32[($2 + 4 | 0) >> 2] = HEAP32[($2 + 4 | 0) >> 2] | 0 | 1 | 0;
    _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$13dispose_chunk17hae588b8b17945682E($1 | 0, $3 | 0);
   }
   $2 = $0 + 8 | 0;
  }
  return $2 | 0;
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$6malloc17h56d0ddc1cdd2a835E($0) {
  $0 = $0 | 0;
  var $2 = 0, $7 = 0, $6 = 0, $3 = 0, $8 = 0, $9 = 0, $5 = 0, i64toi32_i32$1 = 0, $1 = 0, $4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, $244 = 0, $274 = 0, $713 = 0, $788 = 0, $10 = 0, $10$hi = 0, $816 = 0, $1034 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  block2 : {
   block3 : {
    block34 : {
     block8 : {
      block6 : {
       block : {
        if ($0 >>> 0 < 245 >>> 0) {
         break block
        }
        block1 : {
         if ($0 >>> 0 <= -65588 >>> 0) {
          break block1
         }
         $0 = 0;
         break block2;
        }
        $2 = $0 + 11 | 0;
        $3 = $2 & -8 | 0;
        $4 = HEAP32[(0 + 1052252 | 0) >> 2] | 0;
        if (!$4) {
         break block3
        }
        $5 = 31;
        block4 : {
         if ($0 >>> 0 > 16777204 >>> 0) {
          break block4
         }
         $0 = Math_clz32($2 >>> 8 | 0);
         $5 = ((($3 >>> (38 - $0 | 0) | 0) & 1 | 0) - ($0 << 1 | 0) | 0) + 62 | 0;
        }
        $2 = 0 - $3 | 0;
        block5 : {
         $6 = HEAP32[(($5 << 2 | 0) + 1051840 | 0) >> 2] | 0;
         if ($6) {
          break block5
         }
         $7 = 0;
         $0 = 0;
         break block6;
        }
        $7 = 0;
        $8 = $3 << (($5 | 0) == (31 | 0) ? 0 : 25 - ($5 >>> 1 | 0) | 0) | 0;
        $0 = 0;
        label : while (1) {
         block7 : {
          $9 = (HEAP32[($6 + 4 | 0) >> 2] | 0) & -8 | 0;
          if ($9 >>> 0 < $3 >>> 0) {
           break block7
          }
          $9 = $9 - $3 | 0;
          if ($9 >>> 0 >= $2 >>> 0) {
           break block7
          }
          $7 = $6;
          $2 = $9;
          if ($2) {
           break block7
          }
          $2 = 0;
          $0 = $6;
          $7 = $0;
          break block8;
         }
         $9 = HEAP32[($6 + 20 | 0) >> 2] | 0;
         $6 = HEAP32[(($6 + (($8 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
         $0 = $9 ? (($9 | 0) != ($6 | 0) ? $9 : $0) : $0;
         $8 = $8 << 1 | 0;
         if (!$6) {
          break block6
         }
         continue label;
        };
       }
       block17 : {
        block21 : {
         block12 : {
          block11 : {
           block10 : {
            block9 : {
             $6 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
             $3 = $0 >>> 0 < 11 >>> 0 ? 16 : ($0 + 11 | 0) & 504 | 0;
             $2 = $3 >>> 3 | 0;
             $0 = $6 >>> $2 | 0;
             if (!($0 & 3 | 0)) {
              break block9
             }
             $8 = (($0 ^ -1 | 0) & 1 | 0) + $2 | 0;
             $3 = $8 << 3 | 0;
             $0 = $3 + 1051984 | 0;
             $2 = HEAP32[($3 + 1051992 | 0) >> 2] | 0;
             $7 = HEAP32[($2 + 8 | 0) >> 2] | 0;
             if (($0 | 0) == ($7 | 0)) {
              break block10
             }
             HEAP32[($7 + 12 | 0) >> 2] = $0;
             HEAP32[($0 + 8 | 0) >> 2] = $7;
             break block11;
            }
            if ($3 >>> 0 <= (HEAP32[(0 + 1052256 | 0) >> 2] | 0) >>> 0) {
             break block3
            }
            if ($0) {
             break block12
            }
            $0 = HEAP32[(0 + 1052252 | 0) >> 2] | 0;
            if (!$0) {
             break block3
            }
            $6 = HEAP32[(((__wasm_ctz_i32($0 | 0) | 0) << 2 | 0) + 1051840 | 0) >> 2] | 0;
            $2 = ((HEAP32[($6 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
            $7 = $6;
            label2 : while (1) {
             block13 : {
              $0 = HEAP32[($7 + 16 | 0) >> 2] | 0;
              if ($0) {
               break block13
              }
              $0 = HEAP32[($7 + 20 | 0) >> 2] | 0;
              if ($0) {
               break block13
              }
              $5 = HEAP32[($6 + 24 | 0) >> 2] | 0;
              block16 : {
               block15 : {
                block14 : {
                 $0 = HEAP32[($6 + 12 | 0) >> 2] | 0;
                 if (($0 | 0) != ($6 | 0)) {
                  break block14
                 }
                 $0 = HEAP32[($6 + 20 | 0) >> 2] | 0;
                 $7 = HEAP32[($6 + ($0 ? 20 : 16) | 0) >> 2] | 0;
                 if ($7) {
                  break block15
                 }
                 $0 = 0;
                 break block16;
                }
                $7 = HEAP32[($6 + 8 | 0) >> 2] | 0;
                HEAP32[($7 + 12 | 0) >> 2] = $0;
                HEAP32[($0 + 8 | 0) >> 2] = $7;
                break block16;
               }
               $8 = $0 ? $6 + 20 | 0 : $6 + 16 | 0;
               label1 : while (1) {
                $9 = $8;
                $0 = $7;
                $7 = HEAP32[($0 + 20 | 0) >> 2] | 0;
                $8 = $7 ? $0 + 20 | 0 : $0 + 16 | 0;
                $7 = HEAP32[($0 + ($7 ? 20 : 16) | 0) >> 2] | 0;
                if ($7) {
                 continue label1
                }
                break label1;
               };
               HEAP32[$9 >> 2] = 0;
              }
              if (!$5) {
               break block17
              }
              block20 : {
               block18 : {
                $7 = ((HEAP32[($6 + 28 | 0) >> 2] | 0) << 2 | 0) + 1051840 | 0;
                if (($6 | 0) == (HEAP32[$7 >> 2] | 0 | 0)) {
                 break block18
                }
                block19 : {
                 if ((HEAP32[($5 + 16 | 0) >> 2] | 0 | 0) == ($6 | 0)) {
                  break block19
                 }
                 HEAP32[($5 + 20 | 0) >> 2] = $0;
                 if ($0) {
                  break block20
                 }
                 break block17;
                }
                HEAP32[($5 + 16 | 0) >> 2] = $0;
                if ($0) {
                 break block20
                }
                break block17;
               }
               HEAP32[$7 >> 2] = $0;
               if (!$0) {
                break block21
               }
              }
              HEAP32[($0 + 24 | 0) >> 2] = $5;
              block22 : {
               $7 = HEAP32[($6 + 16 | 0) >> 2] | 0;
               if (!$7) {
                break block22
               }
               HEAP32[($0 + 16 | 0) >> 2] = $7;
               HEAP32[($7 + 24 | 0) >> 2] = $0;
              }
              $7 = HEAP32[($6 + 20 | 0) >> 2] | 0;
              if (!$7) {
               break block17
              }
              HEAP32[($0 + 20 | 0) >> 2] = $7;
              HEAP32[($7 + 24 | 0) >> 2] = $0;
              break block17;
             }
             $7 = ((HEAP32[($0 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
             $244 = $7;
             $7 = $7 >>> 0 < $2 >>> 0;
             $2 = $7 ? $244 : $2;
             $6 = $7 ? $0 : $6;
             $7 = $0;
             continue label2;
            };
           }
           (wasm2js_i32$0 = 0, wasm2js_i32$1 = $6 & (__wasm_rotl_i32(-2 | 0, $8 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052248 | 0) >> 2] = wasm2js_i32$1;
          }
          $0 = $2 + 8 | 0;
          HEAP32[($2 + 4 | 0) >> 2] = $3 | 3 | 0;
          $3 = $2 + $3 | 0;
          HEAP32[($3 + 4 | 0) >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0 | 1 | 0;
          break block2;
         }
         block24 : {
          block23 : {
           $274 = $0 << $2 | 0;
           $0 = 2 << $2 | 0;
           $9 = __wasm_ctz_i32($274 & ($0 | (0 - $0 | 0) | 0) | 0 | 0) | 0;
           $2 = $9 << 3 | 0;
           $7 = $2 + 1051984 | 0;
           $0 = HEAP32[($2 + 1051992 | 0) >> 2] | 0;
           $8 = HEAP32[($0 + 8 | 0) >> 2] | 0;
           if (($7 | 0) == ($8 | 0)) {
            break block23
           }
           HEAP32[($8 + 12 | 0) >> 2] = $7;
           HEAP32[($7 + 8 | 0) >> 2] = $8;
           break block24;
          }
          (wasm2js_i32$0 = 0, wasm2js_i32$1 = $6 & (__wasm_rotl_i32(-2 | 0, $9 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052248 | 0) >> 2] = wasm2js_i32$1;
         }
         HEAP32[($0 + 4 | 0) >> 2] = $3 | 3 | 0;
         $6 = $0 + $3 | 0;
         $7 = $2 - $3 | 0;
         HEAP32[($6 + 4 | 0) >> 2] = $7 | 1 | 0;
         HEAP32[($0 + $2 | 0) >> 2] = $7;
         block25 : {
          $2 = HEAP32[(0 + 1052256 | 0) >> 2] | 0;
          if (!$2) {
           break block25
          }
          $3 = HEAP32[(0 + 1052264 | 0) >> 2] | 0;
          block27 : {
           block26 : {
            $8 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
            $9 = 1 << ($2 >>> 3 | 0) | 0;
            if ($8 & $9 | 0) {
             break block26
            }
            HEAP32[(0 + 1052248 | 0) >> 2] = $8 | $9 | 0;
            $2 = ($2 & -8 | 0) + 1051984 | 0;
            $8 = $2;
            break block27;
           }
           $2 = $2 & -8 | 0;
           $8 = $2 + 1051984 | 0;
           $2 = HEAP32[($2 + 1051992 | 0) >> 2] | 0;
          }
          HEAP32[($8 + 8 | 0) >> 2] = $3;
          HEAP32[($2 + 12 | 0) >> 2] = $3;
          HEAP32[($3 + 12 | 0) >> 2] = $8;
          HEAP32[($3 + 8 | 0) >> 2] = $2;
         }
         $0 = $0 + 8 | 0;
         HEAP32[(0 + 1052264 | 0) >> 2] = $6;
         HEAP32[(0 + 1052256 | 0) >> 2] = $7;
         break block2;
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 1052252 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, HEAP32[($6 + 28 | 0) >> 2] | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052252 | 0) >> 2] = wasm2js_i32$1;
       }
       block32 : {
        block29 : {
         block28 : {
          if ($2 >>> 0 < 16 >>> 0) {
           break block28
          }
          HEAP32[($6 + 4 | 0) >> 2] = $3 | 3 | 0;
          $7 = $6 + $3 | 0;
          HEAP32[($7 + 4 | 0) >> 2] = $2 | 1 | 0;
          HEAP32[($7 + $2 | 0) >> 2] = $2;
          $8 = HEAP32[(0 + 1052256 | 0) >> 2] | 0;
          if (!$8) {
           break block29
          }
          $0 = HEAP32[(0 + 1052264 | 0) >> 2] | 0;
          block31 : {
           block30 : {
            $9 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
            $5 = 1 << ($8 >>> 3 | 0) | 0;
            if ($9 & $5 | 0) {
             break block30
            }
            HEAP32[(0 + 1052248 | 0) >> 2] = $9 | $5 | 0;
            $8 = ($8 & -8 | 0) + 1051984 | 0;
            $9 = $8;
            break block31;
           }
           $8 = $8 & -8 | 0;
           $9 = $8 + 1051984 | 0;
           $8 = HEAP32[($8 + 1051992 | 0) >> 2] | 0;
          }
          HEAP32[($9 + 8 | 0) >> 2] = $0;
          HEAP32[($8 + 12 | 0) >> 2] = $0;
          HEAP32[($0 + 12 | 0) >> 2] = $9;
          HEAP32[($0 + 8 | 0) >> 2] = $8;
          break block29;
         }
         $0 = $2 + $3 | 0;
         HEAP32[($6 + 4 | 0) >> 2] = $0 | 3 | 0;
         $0 = $6 + $0 | 0;
         HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
         break block32;
        }
        HEAP32[(0 + 1052264 | 0) >> 2] = $7;
        HEAP32[(0 + 1052256 | 0) >> 2] = $2;
       }
       $0 = $6 + 8 | 0;
       if (!$0) {
        break block3
       }
       break block2;
      }
      block33 : {
       if ($0 | $7 | 0) {
        break block33
       }
       $7 = 0;
       $0 = 2 << $5 | 0;
       $0 = ($0 | (0 - $0 | 0) | 0) & $4 | 0;
       if (!$0) {
        break block3
       }
       $0 = HEAP32[(((__wasm_ctz_i32($0 | 0) | 0) << 2 | 0) + 1051840 | 0) >> 2] | 0;
      }
      if (!$0) {
       break block34
      }
     }
     label3 : while (1) {
      $6 = (HEAP32[($0 + 4 | 0) >> 2] | 0) & -8 | 0;
      $8 = $6 - $3 | 0;
      $9 = $8 >>> 0 < $2 >>> 0;
      $5 = $9 ? $8 : $2;
      $8 = $6 >>> 0 < $3 >>> 0;
      $9 = $9 ? $0 : $7;
      block35 : {
       $6 = HEAP32[($0 + 16 | 0) >> 2] | 0;
       if ($6) {
        break block35
       }
       $6 = HEAP32[($0 + 20 | 0) >> 2] | 0;
      }
      $2 = $8 ? $2 : $5;
      $7 = $8 ? $7 : $9;
      $0 = $6;
      if ($0) {
       continue label3
      }
      break label3;
     };
    }
    if (!$7) {
     break block3
    }
    block36 : {
     $0 = HEAP32[(0 + 1052256 | 0) >> 2] | 0;
     if ($0 >>> 0 < $3 >>> 0) {
      break block36
     }
     if ($2 >>> 0 >= ($0 - $3 | 0) >>> 0) {
      break block3
     }
    }
    $5 = HEAP32[($7 + 24 | 0) >> 2] | 0;
    block39 : {
     block38 : {
      block37 : {
       $0 = HEAP32[($7 + 12 | 0) >> 2] | 0;
       if (($0 | 0) != ($7 | 0)) {
        break block37
       }
       $0 = HEAP32[($7 + 20 | 0) >> 2] | 0;
       $6 = HEAP32[($7 + ($0 ? 20 : 16) | 0) >> 2] | 0;
       if ($6) {
        break block38
       }
       $0 = 0;
       break block39;
      }
      $6 = HEAP32[($7 + 8 | 0) >> 2] | 0;
      HEAP32[($6 + 12 | 0) >> 2] = $0;
      HEAP32[($0 + 8 | 0) >> 2] = $6;
      break block39;
     }
     $8 = $0 ? $7 + 20 | 0 : $7 + 16 | 0;
     label4 : while (1) {
      $9 = $8;
      $0 = $6;
      $6 = HEAP32[($0 + 20 | 0) >> 2] | 0;
      $8 = $6 ? $0 + 20 | 0 : $0 + 16 | 0;
      $6 = HEAP32[($0 + ($6 ? 20 : 16) | 0) >> 2] | 0;
      if ($6) {
       continue label4
      }
      break label4;
     };
     HEAP32[$9 >> 2] = 0;
    }
    block40 : {
     if (!$5) {
      break block40
     }
     block44 : {
      block43 : {
       block41 : {
        $6 = ((HEAP32[($7 + 28 | 0) >> 2] | 0) << 2 | 0) + 1051840 | 0;
        if (($7 | 0) == (HEAP32[$6 >> 2] | 0 | 0)) {
         break block41
        }
        block42 : {
         if ((HEAP32[($5 + 16 | 0) >> 2] | 0 | 0) == ($7 | 0)) {
          break block42
         }
         HEAP32[($5 + 20 | 0) >> 2] = $0;
         if ($0) {
          break block43
         }
         break block40;
        }
        HEAP32[($5 + 16 | 0) >> 2] = $0;
        if ($0) {
         break block43
        }
        break block40;
       }
       HEAP32[$6 >> 2] = $0;
       if (!$0) {
        break block44
       }
      }
      HEAP32[($0 + 24 | 0) >> 2] = $5;
      block45 : {
       $6 = HEAP32[($7 + 16 | 0) >> 2] | 0;
       if (!$6) {
        break block45
       }
       HEAP32[($0 + 16 | 0) >> 2] = $6;
       HEAP32[($6 + 24 | 0) >> 2] = $0;
      }
      $6 = HEAP32[($7 + 20 | 0) >> 2] | 0;
      if (!$6) {
       break block40
      }
      HEAP32[($0 + 20 | 0) >> 2] = $6;
      HEAP32[($6 + 24 | 0) >> 2] = $0;
      break block40;
     }
     (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 1052252 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, HEAP32[($7 + 28 | 0) >> 2] | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052252 | 0) >> 2] = wasm2js_i32$1;
    }
    block48 : {
     block46 : {
      if ($2 >>> 0 < 16 >>> 0) {
       break block46
      }
      HEAP32[($7 + 4 | 0) >> 2] = $3 | 3 | 0;
      $0 = $7 + $3 | 0;
      HEAP32[($0 + 4 | 0) >> 2] = $2 | 1 | 0;
      HEAP32[($0 + $2 | 0) >> 2] = $2;
      block47 : {
       if ($2 >>> 0 < 256 >>> 0) {
        break block47
       }
       _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($0 | 0, $2 | 0);
       break block48;
      }
      block50 : {
       block49 : {
        $6 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
        $8 = 1 << ($2 >>> 3 | 0) | 0;
        if ($6 & $8 | 0) {
         break block49
        }
        HEAP32[(0 + 1052248 | 0) >> 2] = $6 | $8 | 0;
        $2 = ($2 & 248 | 0) + 1051984 | 0;
        $6 = $2;
        break block50;
       }
       $2 = $2 & 248 | 0;
       $6 = $2 + 1051984 | 0;
       $2 = HEAP32[($2 + 1051992 | 0) >> 2] | 0;
      }
      HEAP32[($6 + 8 | 0) >> 2] = $0;
      HEAP32[($2 + 12 | 0) >> 2] = $0;
      HEAP32[($0 + 12 | 0) >> 2] = $6;
      HEAP32[($0 + 8 | 0) >> 2] = $2;
      break block48;
     }
     $0 = $2 + $3 | 0;
     HEAP32[($7 + 4 | 0) >> 2] = $0 | 3 | 0;
     $0 = $7 + $0 | 0;
     HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
    }
    $0 = $7 + 8 | 0;
    if ($0) {
     break block2
    }
   }
   block59 : {
    block73 : {
     block70 : {
      block69 : {
       block60 : {
        block51 : {
         $0 = HEAP32[(0 + 1052256 | 0) >> 2] | 0;
         if ($0 >>> 0 >= $3 >>> 0) {
          break block51
         }
         block52 : {
          $0 = HEAP32[(0 + 1052260 | 0) >> 2] | 0;
          if ($0 >>> 0 > $3 >>> 0) {
           break block52
          }
          _ZN61_$LT$dlmalloc__sys__System$u20$as$u20$dlmalloc__Allocator$GT$5alloc17h5e0d28c009e5d62cE($1 + 4 | 0 | 0, 1052292 | 0, ($3 + 65583 | 0) & -65536 | 0 | 0);
          block53 : {
           $6 = HEAP32[($1 + 4 | 0) >> 2] | 0;
           if ($6) {
            break block53
           }
           $0 = 0;
           break block2;
          }
          $5 = HEAP32[($1 + 12 | 0) >> 2] | 0;
          $9 = HEAP32[($1 + 8 | 0) >> 2] | 0;
          $0 = (HEAP32[(0 + 1052272 | 0) >> 2] | 0) + $9 | 0;
          HEAP32[(0 + 1052272 | 0) >> 2] = $0;
          $2 = HEAP32[(0 + 1052276 | 0) >> 2] | 0;
          HEAP32[(0 + 1052276 | 0) >> 2] = $0 >>> 0 > $2 >>> 0 ? $0 : $2;
          block56 : {
           block55 : {
            block54 : {
             $2 = HEAP32[(0 + 1052268 | 0) >> 2] | 0;
             if (!$2) {
              break block54
             }
             $0 = 1051968;
             label5 : while (1) {
              $7 = HEAP32[$0 >> 2] | 0;
              $8 = HEAP32[($0 + 4 | 0) >> 2] | 0;
              if (($6 | 0) == ($7 + $8 | 0 | 0)) {
               break block55
              }
              $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
              if ($0) {
               continue label5
              }
              break block56;
             };
            }
            block58 : {
             block57 : {
              $0 = HEAP32[(0 + 1052284 | 0) >> 2] | 0;
              if (!$0) {
               break block57
              }
              if ($6 >>> 0 >= $0 >>> 0) {
               break block58
              }
             }
             HEAP32[(0 + 1052284 | 0) >> 2] = $6;
            }
            HEAP32[(0 + 1052288 | 0) >> 2] = 4095;
            HEAP32[(0 + 1051980 | 0) >> 2] = $5;
            HEAP32[(0 + 1051972 | 0) >> 2] = $9;
            HEAP32[(0 + 1051968 | 0) >> 2] = $6;
            HEAP32[(0 + 1051996 | 0) >> 2] = 1051984;
            HEAP32[(0 + 1052004 | 0) >> 2] = 1051992;
            HEAP32[(0 + 1051992 | 0) >> 2] = 1051984;
            HEAP32[(0 + 1052012 | 0) >> 2] = 1052e3;
            HEAP32[(0 + 1052e3 | 0) >> 2] = 1051992;
            HEAP32[(0 + 1052020 | 0) >> 2] = 1052008;
            HEAP32[(0 + 1052008 | 0) >> 2] = 1052e3;
            HEAP32[(0 + 1052028 | 0) >> 2] = 1052016;
            HEAP32[(0 + 1052016 | 0) >> 2] = 1052008;
            HEAP32[(0 + 1052036 | 0) >> 2] = 1052024;
            HEAP32[(0 + 1052024 | 0) >> 2] = 1052016;
            HEAP32[(0 + 1052044 | 0) >> 2] = 1052032;
            HEAP32[(0 + 1052032 | 0) >> 2] = 1052024;
            HEAP32[(0 + 1052052 | 0) >> 2] = 1052040;
            HEAP32[(0 + 1052040 | 0) >> 2] = 1052032;
            HEAP32[(0 + 1052060 | 0) >> 2] = 1052048;
            HEAP32[(0 + 1052048 | 0) >> 2] = 1052040;
            HEAP32[(0 + 1052056 | 0) >> 2] = 1052048;
            HEAP32[(0 + 1052068 | 0) >> 2] = 1052056;
            HEAP32[(0 + 1052064 | 0) >> 2] = 1052056;
            HEAP32[(0 + 1052076 | 0) >> 2] = 1052064;
            HEAP32[(0 + 1052072 | 0) >> 2] = 1052064;
            HEAP32[(0 + 1052084 | 0) >> 2] = 1052072;
            HEAP32[(0 + 1052080 | 0) >> 2] = 1052072;
            HEAP32[(0 + 1052092 | 0) >> 2] = 1052080;
            HEAP32[(0 + 1052088 | 0) >> 2] = 1052080;
            HEAP32[(0 + 1052100 | 0) >> 2] = 1052088;
            HEAP32[(0 + 1052096 | 0) >> 2] = 1052088;
            HEAP32[(0 + 1052108 | 0) >> 2] = 1052096;
            HEAP32[(0 + 1052104 | 0) >> 2] = 1052096;
            HEAP32[(0 + 1052116 | 0) >> 2] = 1052104;
            HEAP32[(0 + 1052112 | 0) >> 2] = 1052104;
            HEAP32[(0 + 1052124 | 0) >> 2] = 1052112;
            HEAP32[(0 + 1052132 | 0) >> 2] = 1052120;
            HEAP32[(0 + 1052120 | 0) >> 2] = 1052112;
            HEAP32[(0 + 1052140 | 0) >> 2] = 1052128;
            HEAP32[(0 + 1052128 | 0) >> 2] = 1052120;
            HEAP32[(0 + 1052148 | 0) >> 2] = 1052136;
            HEAP32[(0 + 1052136 | 0) >> 2] = 1052128;
            HEAP32[(0 + 1052156 | 0) >> 2] = 1052144;
            HEAP32[(0 + 1052144 | 0) >> 2] = 1052136;
            HEAP32[(0 + 1052164 | 0) >> 2] = 1052152;
            HEAP32[(0 + 1052152 | 0) >> 2] = 1052144;
            HEAP32[(0 + 1052172 | 0) >> 2] = 1052160;
            HEAP32[(0 + 1052160 | 0) >> 2] = 1052152;
            HEAP32[(0 + 1052180 | 0) >> 2] = 1052168;
            HEAP32[(0 + 1052168 | 0) >> 2] = 1052160;
            HEAP32[(0 + 1052188 | 0) >> 2] = 1052176;
            HEAP32[(0 + 1052176 | 0) >> 2] = 1052168;
            HEAP32[(0 + 1052196 | 0) >> 2] = 1052184;
            HEAP32[(0 + 1052184 | 0) >> 2] = 1052176;
            HEAP32[(0 + 1052204 | 0) >> 2] = 1052192;
            HEAP32[(0 + 1052192 | 0) >> 2] = 1052184;
            HEAP32[(0 + 1052212 | 0) >> 2] = 1052200;
            HEAP32[(0 + 1052200 | 0) >> 2] = 1052192;
            HEAP32[(0 + 1052220 | 0) >> 2] = 1052208;
            HEAP32[(0 + 1052208 | 0) >> 2] = 1052200;
            HEAP32[(0 + 1052228 | 0) >> 2] = 1052216;
            HEAP32[(0 + 1052216 | 0) >> 2] = 1052208;
            HEAP32[(0 + 1052236 | 0) >> 2] = 1052224;
            HEAP32[(0 + 1052224 | 0) >> 2] = 1052216;
            HEAP32[(0 + 1052244 | 0) >> 2] = 1052232;
            HEAP32[(0 + 1052232 | 0) >> 2] = 1052224;
            $0 = ($6 + 15 | 0) & -8 | 0;
            $2 = $0 + -8 | 0;
            HEAP32[(0 + 1052268 | 0) >> 2] = $2;
            HEAP32[(0 + 1052240 | 0) >> 2] = 1052232;
            $713 = $6 - $0 | 0;
            $0 = $9 + -40 | 0;
            $7 = ($713 + $0 | 0) + 8 | 0;
            HEAP32[(0 + 1052260 | 0) >> 2] = $7;
            HEAP32[($2 + 4 | 0) >> 2] = $7 | 1 | 0;
            HEAP32[(($6 + $0 | 0) + 4 | 0) >> 2] = 40;
            HEAP32[(0 + 1052280 | 0) >> 2] = 2097152;
            break block59;
           }
           if ($2 >>> 0 >= $6 >>> 0) {
            break block56
           }
           if ($7 >>> 0 > $2 >>> 0) {
            break block56
           }
           $7 = HEAP32[($0 + 12 | 0) >> 2] | 0;
           if ($7 & 1 | 0) {
            break block56
           }
           if (($7 >>> 1 | 0 | 0) == ($5 | 0)) {
            break block60
           }
          }
          $0 = HEAP32[(0 + 1052284 | 0) >> 2] | 0;
          HEAP32[(0 + 1052284 | 0) >> 2] = $0 >>> 0 < $6 >>> 0 ? $0 : $6;
          $7 = $6 + $9 | 0;
          $0 = 1051968;
          block63 : {
           block62 : {
            block61 : {
             label6 : while (1) {
              $8 = HEAP32[$0 >> 2] | 0;
              if (($8 | 0) == ($7 | 0)) {
               break block61
              }
              $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
              if ($0) {
               continue label6
              }
              break block62;
             };
            }
            $7 = HEAP32[($0 + 12 | 0) >> 2] | 0;
            if ($7 & 1 | 0) {
             break block62
            }
            if (($7 >>> 1 | 0 | 0) == ($5 | 0)) {
             break block63
            }
           }
           $0 = 1051968;
           block65 : {
            label7 : while (1) {
             block64 : {
              $7 = HEAP32[$0 >> 2] | 0;
              if ($7 >>> 0 > $2 >>> 0) {
               break block64
              }
              $7 = $7 + (HEAP32[($0 + 4 | 0) >> 2] | 0) | 0;
              if ($2 >>> 0 < $7 >>> 0) {
               break block65
              }
             }
             $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
             continue label7;
            };
           }
           $0 = ($6 + 15 | 0) & -8 | 0;
           $8 = $0 + -8 | 0;
           HEAP32[(0 + 1052268 | 0) >> 2] = $8;
           $788 = $6 - $0 | 0;
           $0 = $9 + -40 | 0;
           $4 = ($788 + $0 | 0) + 8 | 0;
           HEAP32[(0 + 1052260 | 0) >> 2] = $4;
           HEAP32[($8 + 4 | 0) >> 2] = $4 | 1 | 0;
           HEAP32[(($6 + $0 | 0) + 4 | 0) >> 2] = 40;
           HEAP32[(0 + 1052280 | 0) >> 2] = 2097152;
           $0 = (($7 + -32 | 0) & -8 | 0) + -8 | 0;
           $8 = $0 >>> 0 < ($2 + 16 | 0) >>> 0 ? $2 : $0;
           HEAP32[($8 + 4 | 0) >> 2] = 27;
           i64toi32_i32$2 = 0;
           i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1051968 | 0) >> 2] | 0;
           i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1051972 | 0) >> 2] | 0;
           $10 = i64toi32_i32$0;
           $10$hi = i64toi32_i32$1;
           i64toi32_i32$2 = 0;
           i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1051976 | 0) >> 2] | 0;
           i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1051980 | 0) >> 2] | 0;
           $816 = i64toi32_i32$1;
           i64toi32_i32$1 = $8 + 16 | 0;
           HEAP32[i64toi32_i32$1 >> 2] = $816;
           HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
           $0 = $8 + 8 | 0;
           i64toi32_i32$0 = $10$hi;
           i64toi32_i32$1 = $0;
           HEAP32[$0 >> 2] = $10;
           HEAP32[($0 + 4 | 0) >> 2] = i64toi32_i32$0;
           HEAP32[(0 + 1051980 | 0) >> 2] = $5;
           HEAP32[(0 + 1051972 | 0) >> 2] = $9;
           HEAP32[(0 + 1051968 | 0) >> 2] = $6;
           HEAP32[(0 + 1051976 | 0) >> 2] = $0;
           $0 = $8 + 28 | 0;
           label8 : while (1) {
            HEAP32[$0 >> 2] = 7;
            $0 = $0 + 4 | 0;
            if ($0 >>> 0 < $7 >>> 0) {
             continue label8
            }
            break label8;
           };
           if (($8 | 0) == ($2 | 0)) {
            break block59
           }
           HEAP32[($8 + 4 | 0) >> 2] = (HEAP32[($8 + 4 | 0) >> 2] | 0) & -2 | 0;
           $0 = $8 - $2 | 0;
           HEAP32[($2 + 4 | 0) >> 2] = $0 | 1 | 0;
           HEAP32[$8 >> 2] = $0;
           block66 : {
            if ($0 >>> 0 < 256 >>> 0) {
             break block66
            }
            _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($2 | 0, $0 | 0);
            break block59;
           }
           block68 : {
            block67 : {
             $7 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
             $6 = 1 << ($0 >>> 3 | 0) | 0;
             if ($7 & $6 | 0) {
              break block67
             }
             HEAP32[(0 + 1052248 | 0) >> 2] = $7 | $6 | 0;
             $0 = ($0 & 248 | 0) + 1051984 | 0;
             $7 = $0;
             break block68;
            }
            $0 = $0 & 248 | 0;
            $7 = $0 + 1051984 | 0;
            $0 = HEAP32[($0 + 1051992 | 0) >> 2] | 0;
           }
           HEAP32[($7 + 8 | 0) >> 2] = $2;
           HEAP32[($0 + 12 | 0) >> 2] = $2;
           HEAP32[($2 + 12 | 0) >> 2] = $7;
           HEAP32[($2 + 8 | 0) >> 2] = $0;
           break block59;
          }
          HEAP32[$0 >> 2] = $6;
          HEAP32[($0 + 4 | 0) >> 2] = (HEAP32[($0 + 4 | 0) >> 2] | 0) + $9 | 0;
          $7 = (($6 + 15 | 0) & -8 | 0) + -8 | 0;
          HEAP32[($7 + 4 | 0) >> 2] = $3 | 3 | 0;
          $2 = (($8 + 15 | 0) & -8 | 0) + -8 | 0;
          $0 = $7 + $3 | 0;
          $3 = $2 - $0 | 0;
          if (($2 | 0) == (HEAP32[(0 + 1052268 | 0) >> 2] | 0 | 0)) {
           break block69
          }
          if (($2 | 0) == (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
           break block70
          }
          block71 : {
           $6 = HEAP32[($2 + 4 | 0) >> 2] | 0;
           if (($6 & 3 | 0 | 0) != (1 | 0)) {
            break block71
           }
           $6 = $6 & -8 | 0;
           _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($2 | 0, $6 | 0);
           $3 = $6 + $3 | 0;
           $2 = $2 + $6 | 0;
           $6 = HEAP32[($2 + 4 | 0) >> 2] | 0;
          }
          HEAP32[($2 + 4 | 0) >> 2] = $6 & -2 | 0;
          HEAP32[($0 + 4 | 0) >> 2] = $3 | 1 | 0;
          HEAP32[($0 + $3 | 0) >> 2] = $3;
          block72 : {
           if ($3 >>> 0 < 256 >>> 0) {
            break block72
           }
           _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($0 | 0, $3 | 0);
           break block73;
          }
          block75 : {
           block74 : {
            $2 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
            $6 = 1 << ($3 >>> 3 | 0) | 0;
            if ($2 & $6 | 0) {
             break block74
            }
            HEAP32[(0 + 1052248 | 0) >> 2] = $2 | $6 | 0;
            $3 = ($3 & 248 | 0) + 1051984 | 0;
            $2 = $3;
            break block75;
           }
           $3 = $3 & 248 | 0;
           $2 = $3 + 1051984 | 0;
           $3 = HEAP32[($3 + 1051992 | 0) >> 2] | 0;
          }
          HEAP32[($2 + 8 | 0) >> 2] = $0;
          HEAP32[($3 + 12 | 0) >> 2] = $0;
          HEAP32[($0 + 12 | 0) >> 2] = $2;
          HEAP32[($0 + 8 | 0) >> 2] = $3;
          break block73;
         }
         $2 = $0 - $3 | 0;
         HEAP32[(0 + 1052260 | 0) >> 2] = $2;
         $0 = HEAP32[(0 + 1052268 | 0) >> 2] | 0;
         $7 = $0 + $3 | 0;
         HEAP32[(0 + 1052268 | 0) >> 2] = $7;
         HEAP32[($7 + 4 | 0) >> 2] = $2 | 1 | 0;
         HEAP32[($0 + 4 | 0) >> 2] = $3 | 3 | 0;
         $0 = $0 + 8 | 0;
         break block2;
        }
        $2 = HEAP32[(0 + 1052264 | 0) >> 2] | 0;
        block77 : {
         block76 : {
          $7 = $0 - $3 | 0;
          if ($7 >>> 0 > 15 >>> 0) {
           break block76
          }
          HEAP32[(0 + 1052264 | 0) >> 2] = 0;
          HEAP32[(0 + 1052256 | 0) >> 2] = 0;
          HEAP32[($2 + 4 | 0) >> 2] = $0 | 3 | 0;
          $0 = $2 + $0 | 0;
          HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
          break block77;
         }
         HEAP32[(0 + 1052256 | 0) >> 2] = $7;
         $6 = $2 + $3 | 0;
         HEAP32[(0 + 1052264 | 0) >> 2] = $6;
         HEAP32[($6 + 4 | 0) >> 2] = $7 | 1 | 0;
         HEAP32[($2 + $0 | 0) >> 2] = $7;
         HEAP32[($2 + 4 | 0) >> 2] = $3 | 3 | 0;
        }
        $0 = $2 + 8 | 0;
        break block2;
       }
       HEAP32[($0 + 4 | 0) >> 2] = $8 + $9 | 0;
       $0 = HEAP32[(0 + 1052268 | 0) >> 2] | 0;
       $2 = ($0 + 15 | 0) & -8 | 0;
       $7 = $2 + -8 | 0;
       HEAP32[(0 + 1052268 | 0) >> 2] = $7;
       $1034 = $0 - $2 | 0;
       $2 = (HEAP32[(0 + 1052260 | 0) >> 2] | 0) + $9 | 0;
       $6 = ($1034 + $2 | 0) + 8 | 0;
       HEAP32[(0 + 1052260 | 0) >> 2] = $6;
       HEAP32[($7 + 4 | 0) >> 2] = $6 | 1 | 0;
       HEAP32[(($0 + $2 | 0) + 4 | 0) >> 2] = 40;
       HEAP32[(0 + 1052280 | 0) >> 2] = 2097152;
       break block59;
      }
      HEAP32[(0 + 1052268 | 0) >> 2] = $0;
      $3 = (HEAP32[(0 + 1052260 | 0) >> 2] | 0) + $3 | 0;
      HEAP32[(0 + 1052260 | 0) >> 2] = $3;
      HEAP32[($0 + 4 | 0) >> 2] = $3 | 1 | 0;
      break block73;
     }
     HEAP32[(0 + 1052264 | 0) >> 2] = $0;
     $3 = (HEAP32[(0 + 1052256 | 0) >> 2] | 0) + $3 | 0;
     HEAP32[(0 + 1052256 | 0) >> 2] = $3;
     HEAP32[($0 + 4 | 0) >> 2] = $3 | 1 | 0;
     HEAP32[($0 + $3 | 0) >> 2] = $3;
    }
    $0 = $7 + 8 | 0;
    break block2;
   }
   $0 = 0;
   $2 = HEAP32[(0 + 1052260 | 0) >> 2] | 0;
   if ($2 >>> 0 <= $3 >>> 0) {
    break block2
   }
   $2 = $2 - $3 | 0;
   HEAP32[(0 + 1052260 | 0) >> 2] = $2;
   $0 = HEAP32[(0 + 1052268 | 0) >> 2] | 0;
   $7 = $0 + $3 | 0;
   HEAP32[(0 + 1052268 | 0) >> 2] = $7;
   HEAP32[($7 + 4 | 0) >> 2] = $2 | 1 | 0;
   HEAP32[($0 + 4 | 0) >> 2] = $3 | 3 | 0;
   $0 = $0 + 8 | 0;
  }
  __stack_pointer = $1 + 16 | 0;
  return $0 | 0;
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc12___rust_abort() {
  wasm2js_trap();
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc13___rdl_dealloc($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0;
  block2 : {
   block : {
    $3 = HEAP32[($0 + -4 | 0) >> 2] | 0;
    $4 = $3 & -8 | 0;
    $3 = $3 & 3 | 0;
    if ($4 >>> 0 < (($3 ? 4 : 8) + $1 | 0) >>> 0) {
     break block
    }
    block1 : {
     if (!$3) {
      break block1
     }
     if ($4 >>> 0 > ($1 + 39 | 0) >>> 0) {
      break block2
     }
    }
    _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$4free17h1ed7b84c178240f9E($0 | 0);
    return;
   }
   _ZN4core9panicking5panic17h19814263112256c0E(1050584 | 0, 46 | 0, 1050632 | 0);
   wasm2js_trap();
  }
  _ZN4core9panicking5panic17h19814263112256c0E(1050648 | 0, 46 | 0, 1050696 | 0);
  wasm2js_trap();
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$4free17h1ed7b84c178240f9E($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0;
  $1 = $0 + -8 | 0;
  $2 = HEAP32[($0 + -4 | 0) >> 2] | 0;
  $0 = $2 & -8 | 0;
  $3 = $1 + $0 | 0;
  block1 : {
   block : {
    if ($2 & 1 | 0) {
     break block
    }
    if (!($2 & 2 | 0)) {
     break block1
    }
    $2 = HEAP32[$1 >> 2] | 0;
    $0 = $2 + $0 | 0;
    block2 : {
     $1 = $1 - $2 | 0;
     if (($1 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
      break block2
     }
     if (((HEAP32[($3 + 4 | 0) >> 2] | 0) & 3 | 0 | 0) != (3 | 0)) {
      break block
     }
     HEAP32[(0 + 1052256 | 0) >> 2] = $0;
     HEAP32[($3 + 4 | 0) >> 2] = (HEAP32[($3 + 4 | 0) >> 2] | 0) & -2 | 0;
     HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
     HEAP32[$3 >> 2] = $0;
     return;
    }
    _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($1 | 0, $2 | 0);
   }
   block10 : {
    block7 : {
     block5 : {
      block4 : {
       block6 : {
        block3 : {
         $2 = HEAP32[($3 + 4 | 0) >> 2] | 0;
         if ($2 & 2 | 0) {
          break block3
         }
         if (($3 | 0) == (HEAP32[(0 + 1052268 | 0) >> 2] | 0 | 0)) {
          break block4
         }
         if (($3 | 0) == (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
          break block5
         }
         $2 = $2 & -8 | 0;
         _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($3 | 0, $2 | 0);
         $0 = $2 + $0 | 0;
         HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
         HEAP32[($1 + $0 | 0) >> 2] = $0;
         if (($1 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
          break block6
         }
         HEAP32[(0 + 1052256 | 0) >> 2] = $0;
         return;
        }
        HEAP32[($3 + 4 | 0) >> 2] = $2 & -2 | 0;
        HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
        HEAP32[($1 + $0 | 0) >> 2] = $0;
       }
       if ($0 >>> 0 < 256 >>> 0) {
        break block7
       }
       _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($1 | 0, $0 | 0);
       $1 = 0;
       $0 = (HEAP32[(0 + 1052288 | 0) >> 2] | 0) + -1 | 0;
       HEAP32[(0 + 1052288 | 0) >> 2] = $0;
       if ($0) {
        break block1
       }
       block8 : {
        $0 = HEAP32[(0 + 1051976 | 0) >> 2] | 0;
        if (!$0) {
         break block8
        }
        $1 = 0;
        label : while (1) {
         $1 = $1 + 1 | 0;
         $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
         if ($0) {
          continue label
         }
         break label;
        };
       }
       HEAP32[(0 + 1052288 | 0) >> 2] = $1 >>> 0 > 4095 >>> 0 ? $1 : 4095;
       return;
      }
      HEAP32[(0 + 1052268 | 0) >> 2] = $1;
      $0 = (HEAP32[(0 + 1052260 | 0) >> 2] | 0) + $0 | 0;
      HEAP32[(0 + 1052260 | 0) >> 2] = $0;
      HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
      block9 : {
       if (($1 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
        break block9
       }
       HEAP32[(0 + 1052256 | 0) >> 2] = 0;
       HEAP32[(0 + 1052264 | 0) >> 2] = 0;
      }
      $4 = HEAP32[(0 + 1052280 | 0) >> 2] | 0;
      if ($0 >>> 0 <= $4 >>> 0) {
       break block1
      }
      $0 = HEAP32[(0 + 1052268 | 0) >> 2] | 0;
      if (!$0) {
       break block1
      }
      $2 = 0;
      $5 = HEAP32[(0 + 1052260 | 0) >> 2] | 0;
      if ($5 >>> 0 < 41 >>> 0) {
       break block10
      }
      $1 = 1051968;
      label1 : while (1) {
       block11 : {
        $3 = HEAP32[$1 >> 2] | 0;
        if ($3 >>> 0 > $0 >>> 0) {
         break block11
        }
        if ($0 >>> 0 < ($3 + (HEAP32[($1 + 4 | 0) >> 2] | 0) | 0) >>> 0) {
         break block10
        }
       }
       $1 = HEAP32[($1 + 8 | 0) >> 2] | 0;
       continue label1;
      };
     }
     HEAP32[(0 + 1052264 | 0) >> 2] = $1;
     $0 = (HEAP32[(0 + 1052256 | 0) >> 2] | 0) + $0 | 0;
     HEAP32[(0 + 1052256 | 0) >> 2] = $0;
     HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
     HEAP32[($1 + $0 | 0) >> 2] = $0;
     return;
    }
    block13 : {
     block12 : {
      $3 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
      $2 = 1 << ($0 >>> 3 | 0) | 0;
      if ($3 & $2 | 0) {
       break block12
      }
      HEAP32[(0 + 1052248 | 0) >> 2] = $3 | $2 | 0;
      $0 = ($0 & 248 | 0) + 1051984 | 0;
      $3 = $0;
      break block13;
     }
     $0 = $0 & 248 | 0;
     $3 = $0 + 1051984 | 0;
     $0 = HEAP32[($0 + 1051992 | 0) >> 2] | 0;
    }
    HEAP32[($3 + 8 | 0) >> 2] = $1;
    HEAP32[($0 + 12 | 0) >> 2] = $1;
    HEAP32[($1 + 12 | 0) >> 2] = $3;
    HEAP32[($1 + 8 | 0) >> 2] = $0;
    return;
   }
   block14 : {
    $1 = HEAP32[(0 + 1051976 | 0) >> 2] | 0;
    if (!$1) {
     break block14
    }
    $2 = 0;
    label2 : while (1) {
     $2 = $2 + 1 | 0;
     $1 = HEAP32[($1 + 8 | 0) >> 2] | 0;
     if ($1) {
      continue label2
     }
     break label2;
    };
   }
   HEAP32[(0 + 1052288 | 0) >> 2] = $2 >>> 0 > 4095 >>> 0 ? $2 : 4095;
   if ($5 >>> 0 <= $4 >>> 0) {
    break block1
   }
   HEAP32[(0 + 1052280 | 0) >> 2] = -1;
  }
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc13___rdl_realloc($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $7 = 0, $5 = 0, $6 = 0, $8 = 0, $4 = 0, $9 = 0;
  block5 : {
   block18 : {
    block7 : {
     block12 : {
      block15 : {
       block17 : {
        block2 : {
         block : {
          $4 = $0 + -4 | 0;
          $5 = HEAP32[$4 >> 2] | 0;
          $6 = $5 & -8 | 0;
          $7 = $5 & 3 | 0;
          if ($6 >>> 0 < (($7 ? 4 : 8) + $1 | 0) >>> 0) {
           break block
          }
          $8 = $1 + 39 | 0;
          block1 : {
           if (!$7) {
            break block1
           }
           if ($6 >>> 0 > $8 >>> 0) {
            break block2
           }
          }
          block4 : {
           block3 : {
            if ($2 >>> 0 < 9 >>> 0) {
             break block3
            }
            $2 = _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$8memalign17haf349dd76c9a5091E($2 | 0, $3 | 0) | 0;
            if ($2) {
             break block4
            }
            return 0 | 0;
           }
           $2 = 0;
           if ($3 >>> 0 > -65588 >>> 0) {
            break block5
           }
           $1 = $3 >>> 0 < 11 >>> 0 ? 16 : ($3 + 11 | 0) & -8 | 0;
           $8 = $0 + -8 | 0;
           block6 : {
            if ($7) {
             break block6
            }
            if ($1 >>> 0 < 256 >>> 0) {
             break block7
            }
            if (!$8) {
             break block7
            }
            if ($6 >>> 0 <= $1 >>> 0) {
             break block7
            }
            if (($6 - $1 | 0) >>> 0 > 131072 >>> 0) {
             break block7
            }
            return $0 | 0;
           }
           $7 = $8 + $6 | 0;
           block9 : {
            block8 : {
             if ($6 >>> 0 >= $1 >>> 0) {
              break block8
             }
             if (($7 | 0) == (HEAP32[(0 + 1052268 | 0) >> 2] | 0 | 0)) {
              break block9
             }
             block10 : {
              if (($7 | 0) == (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
               break block10
              }
              $5 = HEAP32[($7 + 4 | 0) >> 2] | 0;
              if ($5 & 2 | 0) {
               break block7
              }
              $9 = $5 & -8 | 0;
              $5 = $9 + $6 | 0;
              if ($5 >>> 0 < $1 >>> 0) {
               break block7
              }
              _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($7 | 0, $9 | 0);
              block11 : {
               $7 = $5 - $1 | 0;
               if ($7 >>> 0 < 16 >>> 0) {
                break block11
               }
               HEAP32[$4 >> 2] = $1 | ((HEAP32[$4 >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
               $1 = $8 + $1 | 0;
               HEAP32[($1 + 4 | 0) >> 2] = $7 | 3 | 0;
               $5 = $8 + $5 | 0;
               HEAP32[($5 + 4 | 0) >> 2] = HEAP32[($5 + 4 | 0) >> 2] | 0 | 1 | 0;
               _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$13dispose_chunk17hae588b8b17945682E($1 | 0, $7 | 0);
               break block12;
              }
              HEAP32[$4 >> 2] = $5 | ((HEAP32[$4 >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
              $1 = $8 + $5 | 0;
              HEAP32[($1 + 4 | 0) >> 2] = HEAP32[($1 + 4 | 0) >> 2] | 0 | 1 | 0;
              break block12;
             }
             $7 = (HEAP32[(0 + 1052256 | 0) >> 2] | 0) + $6 | 0;
             if ($7 >>> 0 < $1 >>> 0) {
              break block7
             }
             block14 : {
              block13 : {
               $6 = $7 - $1 | 0;
               if ($6 >>> 0 > 15 >>> 0) {
                break block13
               }
               HEAP32[$4 >> 2] = $5 & 1 | 0 | $7 | 0 | 2 | 0;
               $1 = $8 + $7 | 0;
               HEAP32[($1 + 4 | 0) >> 2] = HEAP32[($1 + 4 | 0) >> 2] | 0 | 1 | 0;
               $6 = 0;
               $1 = 0;
               break block14;
              }
              HEAP32[$4 >> 2] = $1 | ($5 & 1 | 0) | 0 | 2 | 0;
              $1 = $8 + $1 | 0;
              HEAP32[($1 + 4 | 0) >> 2] = $6 | 1 | 0;
              $7 = $8 + $7 | 0;
              HEAP32[$7 >> 2] = $6;
              HEAP32[($7 + 4 | 0) >> 2] = (HEAP32[($7 + 4 | 0) >> 2] | 0) & -2 | 0;
             }
             HEAP32[(0 + 1052264 | 0) >> 2] = $1;
             HEAP32[(0 + 1052256 | 0) >> 2] = $6;
             break block12;
            }
            $6 = $6 - $1 | 0;
            if ($6 >>> 0 <= 15 >>> 0) {
             break block12
            }
            HEAP32[$4 >> 2] = $1 | ($5 & 1 | 0) | 0 | 2 | 0;
            $1 = $8 + $1 | 0;
            HEAP32[($1 + 4 | 0) >> 2] = $6 | 3 | 0;
            HEAP32[($7 + 4 | 0) >> 2] = HEAP32[($7 + 4 | 0) >> 2] | 0 | 1 | 0;
            _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$13dispose_chunk17hae588b8b17945682E($1 | 0, $6 | 0);
            break block12;
           }
           $7 = (HEAP32[(0 + 1052260 | 0) >> 2] | 0) + $6 | 0;
           if ($7 >>> 0 > $1 >>> 0) {
            break block15
           }
           break block7;
          }
          block16 : {
           $3 = $3 >>> 0 < $1 >>> 0 ? $3 : $1;
           if (!$3) {
            break block16
           }
           wasm2js_memory_copy($2, $0, $3);
          }
          $3 = HEAP32[$4 >> 2] | 0;
          $7 = $3 & -8 | 0;
          $3 = $3 & 3 | 0;
          if ($7 >>> 0 < (($3 ? 4 : 8) + $1 | 0) >>> 0) {
           break block17
          }
          if (!$3) {
           break block18
          }
          if ($7 >>> 0 <= $8 >>> 0) {
           break block18
          }
          _ZN4core9panicking5panic17h19814263112256c0E(1050648 | 0, 46 | 0, 1050696 | 0);
          wasm2js_trap();
         }
         _ZN4core9panicking5panic17h19814263112256c0E(1050584 | 0, 46 | 0, 1050632 | 0);
         wasm2js_trap();
        }
        _ZN4core9panicking5panic17h19814263112256c0E(1050648 | 0, 46 | 0, 1050696 | 0);
        wasm2js_trap();
       }
       _ZN4core9panicking5panic17h19814263112256c0E(1050584 | 0, 46 | 0, 1050632 | 0);
       wasm2js_trap();
      }
      HEAP32[$4 >> 2] = $1 | ($5 & 1 | 0) | 0 | 2 | 0;
      $5 = $8 + $1 | 0;
      $1 = $7 - $1 | 0;
      HEAP32[($5 + 4 | 0) >> 2] = $1 | 1 | 0;
      HEAP32[(0 + 1052260 | 0) >> 2] = $1;
      HEAP32[(0 + 1052268 | 0) >> 2] = $5;
     }
     if (!$8) {
      break block7
     }
     return $0 | 0;
    }
    $1 = _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$6malloc17h56d0ddc1cdd2a835E($3 | 0) | 0;
    if (!$1) {
     break block5
    }
    block19 : {
     $2 = HEAP32[$4 >> 2] | 0;
     $2 = ($2 & 3 | 0 ? -4 : -8) + ($2 & -8 | 0) | 0;
     $3 = $3 >>> 0 < $2 >>> 0 ? $3 : $2;
     if (!$3) {
      break block19
     }
     wasm2js_memory_copy($1, $0, $3);
    }
    $2 = $1;
   }
   _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$4free17h1ed7b84c178240f9E($0 | 0);
  }
  return $2 | 0;
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $4 = 0, $3 = 0, $5 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2 = HEAP32[($0 + 12 | 0) >> 2] | 0;
  block8 : {
   block4 : {
    block7 : {
     block : {
      if ($1 >>> 0 < 256 >>> 0) {
       break block
      }
      $3 = HEAP32[($0 + 24 | 0) >> 2] | 0;
      block3 : {
       block2 : {
        block1 : {
         if (($2 | 0) != ($0 | 0)) {
          break block1
         }
         $2 = HEAP32[($0 + 20 | 0) >> 2] | 0;
         $1 = HEAP32[($0 + ($2 ? 20 : 16) | 0) >> 2] | 0;
         if ($1) {
          break block2
         }
         $2 = 0;
         break block3;
        }
        $1 = HEAP32[($0 + 8 | 0) >> 2] | 0;
        HEAP32[($1 + 12 | 0) >> 2] = $2;
        HEAP32[($2 + 8 | 0) >> 2] = $1;
        break block3;
       }
       $4 = $2 ? $0 + 20 | 0 : $0 + 16 | 0;
       label : while (1) {
        $5 = $4;
        $2 = $1;
        $1 = HEAP32[($2 + 20 | 0) >> 2] | 0;
        $4 = $1 ? $2 + 20 | 0 : $2 + 16 | 0;
        $1 = HEAP32[($2 + ($1 ? 20 : 16) | 0) >> 2] | 0;
        if ($1) {
         continue label
        }
        break label;
       };
       HEAP32[$5 >> 2] = 0;
      }
      if (!$3) {
       break block4
      }
      block6 : {
       block5 : {
        $1 = ((HEAP32[($0 + 28 | 0) >> 2] | 0) << 2 | 0) + 1051840 | 0;
        if (($0 | 0) == (HEAP32[$1 >> 2] | 0 | 0)) {
         break block5
        }
        if ((HEAP32[($3 + 16 | 0) >> 2] | 0 | 0) == ($0 | 0)) {
         break block6
        }
        HEAP32[($3 + 20 | 0) >> 2] = $2;
        if ($2) {
         break block7
        }
        break block4;
       }
       HEAP32[$1 >> 2] = $2;
       if (!$2) {
        break block8
       }
       break block7;
      }
      HEAP32[($3 + 16 | 0) >> 2] = $2;
      if ($2) {
       break block7
      }
      break block4;
     }
     block9 : {
      $4 = HEAP32[($0 + 8 | 0) >> 2] | 0;
      if (($2 | 0) == ($4 | 0)) {
       break block9
      }
      HEAP32[($4 + 12 | 0) >> 2] = $2;
      HEAP32[($2 + 8 | 0) >> 2] = $4;
      return;
     }
     (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 1052248 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052248 | 0) >> 2] = wasm2js_i32$1;
     return;
    }
    HEAP32[($2 + 24 | 0) >> 2] = $3;
    block10 : {
     $1 = HEAP32[($0 + 16 | 0) >> 2] | 0;
     if (!$1) {
      break block10
     }
     HEAP32[($2 + 16 | 0) >> 2] = $1;
     HEAP32[($1 + 24 | 0) >> 2] = $2;
    }
    $1 = HEAP32[($0 + 20 | 0) >> 2] | 0;
    if (!$1) {
     break block4
    }
    HEAP32[($2 + 20 | 0) >> 2] = $1;
    HEAP32[($1 + 24 | 0) >> 2] = $2;
    return;
   }
   return;
  }
  (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 1052252 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, HEAP32[($0 + 28 | 0) >> 2] | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 1052252 | 0) >> 2] = wasm2js_i32$1;
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$13dispose_chunk17hae588b8b17945682E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0;
  $2 = $0 + $1 | 0;
  block1 : {
   block : {
    $3 = HEAP32[($0 + 4 | 0) >> 2] | 0;
    if ($3 & 1 | 0) {
     break block
    }
    if (!($3 & 2 | 0)) {
     break block1
    }
    $3 = HEAP32[$0 >> 2] | 0;
    $1 = $3 + $1 | 0;
    block2 : {
     $0 = $0 - $3 | 0;
     if (($0 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
      break block2
     }
     if (((HEAP32[($2 + 4 | 0) >> 2] | 0) & 3 | 0 | 0) != (3 | 0)) {
      break block
     }
     HEAP32[(0 + 1052256 | 0) >> 2] = $1;
     HEAP32[($2 + 4 | 0) >> 2] = (HEAP32[($2 + 4 | 0) >> 2] | 0) & -2 | 0;
     HEAP32[($0 + 4 | 0) >> 2] = $1 | 1 | 0;
     HEAP32[$2 >> 2] = $1;
     break block1;
    }
    _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($0 | 0, $3 | 0);
   }
   block5 : {
    block4 : {
     block6 : {
      block3 : {
       $3 = HEAP32[($2 + 4 | 0) >> 2] | 0;
       if ($3 & 2 | 0) {
        break block3
       }
       if (($2 | 0) == (HEAP32[(0 + 1052268 | 0) >> 2] | 0 | 0)) {
        break block4
       }
       if (($2 | 0) == (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
        break block5
       }
       $3 = $3 & -8 | 0;
       _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$12unlink_chunk17h73e8fc0a8f8e75b2E($2 | 0, $3 | 0);
       $1 = $3 + $1 | 0;
       HEAP32[($0 + 4 | 0) >> 2] = $1 | 1 | 0;
       HEAP32[($0 + $1 | 0) >> 2] = $1;
       if (($0 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
        break block6
       }
       HEAP32[(0 + 1052256 | 0) >> 2] = $1;
       return;
      }
      HEAP32[($2 + 4 | 0) >> 2] = $3 & -2 | 0;
      HEAP32[($0 + 4 | 0) >> 2] = $1 | 1 | 0;
      HEAP32[($0 + $1 | 0) >> 2] = $1;
     }
     block7 : {
      if ($1 >>> 0 < 256 >>> 0) {
       break block7
      }
      _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($0 | 0, $1 | 0);
      return;
     }
     block9 : {
      block8 : {
       $2 = HEAP32[(0 + 1052248 | 0) >> 2] | 0;
       $3 = 1 << ($1 >>> 3 | 0) | 0;
       if ($2 & $3 | 0) {
        break block8
       }
       HEAP32[(0 + 1052248 | 0) >> 2] = $2 | $3 | 0;
       $1 = ($1 & 248 | 0) + 1051984 | 0;
       $2 = $1;
       break block9;
      }
      $1 = $1 & 248 | 0;
      $2 = $1 + 1051984 | 0;
      $1 = HEAP32[($1 + 1051992 | 0) >> 2] | 0;
     }
     HEAP32[($2 + 8 | 0) >> 2] = $0;
     HEAP32[($1 + 12 | 0) >> 2] = $0;
     HEAP32[($0 + 12 | 0) >> 2] = $2;
     HEAP32[($0 + 8 | 0) >> 2] = $1;
     return;
    }
    HEAP32[(0 + 1052268 | 0) >> 2] = $0;
    $1 = (HEAP32[(0 + 1052260 | 0) >> 2] | 0) + $1 | 0;
    HEAP32[(0 + 1052260 | 0) >> 2] = $1;
    HEAP32[($0 + 4 | 0) >> 2] = $1 | 1 | 0;
    if (($0 | 0) != (HEAP32[(0 + 1052264 | 0) >> 2] | 0 | 0)) {
     break block1
    }
    HEAP32[(0 + 1052256 | 0) >> 2] = 0;
    HEAP32[(0 + 1052264 | 0) >> 2] = 0;
    return;
   }
   HEAP32[(0 + 1052264 | 0) >> 2] = $0;
   $1 = (HEAP32[(0 + 1052256 | 0) >> 2] | 0) + $1 | 0;
   HEAP32[(0 + 1052256 | 0) >> 2] = $1;
   HEAP32[($0 + 4 | 0) >> 2] = $1 | 1 | 0;
   HEAP32[($0 + $1 | 0) >> 2] = $1;
   return;
  }
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc17rust_begin_unwind($0) {
  $0 = $0 | 0;
  var $1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $11 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  i64toi32_i32$0 = HEAP32[$0 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  HEAP32[($1 + 12 | 0) >> 2] = $0;
  $11 = i64toi32_i32$0;
  i64toi32_i32$0 = $1;
  HEAP32[($1 + 4 | 0) >> 2] = $11;
  HEAP32[($1 + 8 | 0) >> 2] = i64toi32_i32$1;
  _ZN3std3sys9backtrace26__rust_end_short_backtrace17hc8287529a3915aa1E($1 + 4 | 0 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std3sys9backtrace26__rust_end_short_backtrace17hc8287529a3915aa1E($0) {
  $0 = $0 | 0;
  _ZN3std9panicking13panic_handler28_$u7b$$u7b$closure$u7d$$u7d$17hc45753d38c23abcfE($0 | 0);
  wasm2js_trap();
 }
 
 function _RNvCs5QKde7ScR4H_7___rustc26___rust_alloc_error_handler($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  _ZN3std5alloc8rust_oom17h7a8d9eb6e4a15477E($1 | 0, $0 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std5alloc8rust_oom17h7a8d9eb6e4a15477E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  HEAP32[($2 + 12 | 0) >> 2] = $1;
  HEAP32[($2 + 8 | 0) >> 2] = $0;
  _ZN3std3sys9backtrace26__rust_end_short_backtrace17h341ccca66f3093f3E($2 + 8 | 0 | 0);
  wasm2js_trap();
 }
 
 function _ZN36_$LT$T$u20$as$u20$core__any__Any$GT$7type_id17h6197f0ebcddc27d1E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $4 = 0, $6 = 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1050372 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1050376 | 0) >> 2] | 0;
  $4 = i64toi32_i32$0;
  i64toi32_i32$0 = $0 + 8 | 0;
  HEAP32[i64toi32_i32$0 >> 2] = $4;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1050364 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1050368 | 0) >> 2] | 0;
  $6 = i64toi32_i32$1;
  i64toi32_i32$1 = $0;
  HEAP32[i64toi32_i32$1 >> 2] = $6;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
 }
 
 function _ZN36_$LT$T$u20$as$u20$core__any__Any$GT$7type_id17hb068e4e2067c10daE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $4 = 0, $6 = 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1050388 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1050392 | 0) >> 2] | 0;
  $4 = i64toi32_i32$0;
  i64toi32_i32$0 = $0 + 8 | 0;
  HEAP32[i64toi32_i32$0 >> 2] = $4;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 1050380 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 1050384 | 0) >> 2] | 0;
  $6 = i64toi32_i32$1;
  i64toi32_i32$1 = $0;
  HEAP32[i64toi32_i32$1 >> 2] = $6;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hfdc0e158016a3786E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $19 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  block : {
   $1 = $2 + $1 | 0;
   if ($1 >>> 0 >= $2 >>> 0) {
    break block
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(0 | 0, 0 | 0);
   wasm2js_trap();
  }
  $2 = HEAP32[$0 >> 2] | 0;
  $19 = $2;
  $2 = $2 << 1 | 0;
  $2 = $1 >>> 0 > $2 >>> 0 ? $1 : $2;
  $1 = ($4 | 0) == (1 | 0) ? 8 : 4;
  $2 = $2 >>> 0 > $1 >>> 0 ? $2 : $1;
  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17h2960490eaec09c54E($5 + 4 | 0 | 0, $19 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $2 | 0, $3 | 0, $4 | 0);
  block1 : {
   if ((HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) != (1 | 0)) {
    break block1
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 12 | 0) >> 2] | 0 | 0);
   wasm2js_trap();
  }
  $4 = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[$0 >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $4;
  __stack_pointer = $5 + 16 | 0;
 }
 
 function _ZN4core9panicking13assert_failed17hc08e79bb2e591ce8E($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $2;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  _ZN4core9panicking19assert_failed_inner17hfb039360ece1159dE($0 | 0, $6 + 8 | 0 | 0, 1050540 | 0, $6 + 12 | 0 | 0, 1050540 | 0, $3 | 0, $4 | 0, $5 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std4sync9lazy_lock14panic_poisoned17h955bb12d72c833a2E() {
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050396 | 0, 93 | 0, 1050444 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std3sys6random11unsupported19hashmap_random_keys17h8ce533668958160aE($0) {
  $0 = $0 | 0;
  var $1 = 0, i64toi32_i32$1 = 0, $2 = 0, i64toi32_i32$0 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  HEAP8[($1 + 15 | 0) >> 0] = 0;
  _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
  block : {
   $2 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(1 | 0, 1 | 0) | 0;
   if ($2) {
    break block
   }
   _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E(1 | 0, 1 | 0);
   wasm2js_trap();
  }
  i64toi32_i32$0 = 0;
  i64toi32_i32$1 = $0;
  HEAP32[i64toi32_i32$1 >> 2] = $1 + 15 | 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = $2;
  HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] = i64toi32_i32$0;
  _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($2 | 0, 1 | 0, 1 | 0);
  __stack_pointer = $1 + 16 | 0;
 }
 
 function _ZN3std3sys9backtrace26__rust_end_short_backtrace17h341ccca66f3093f3E($0) {
  $0 = $0 | 0;
  _ZN3std5alloc8rust_oom28_$u7b$$u7b$closure$u7d$$u7d$17hd13bcc51971a1721E($0 | 0);
  wasm2js_trap();
 }
 
 function _ZN3std5alloc8rust_oom28_$u7b$$u7b$closure$u7d$$u7d$17hd13bcc51971a1721E($0) {
  $0 = $0 | 0;
  var $2 = 0, $4 = 0;
  $2 = HEAP32[$0 >> 2] | 0;
  $4 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  $0 = HEAP32[(0 + 1052324 | 0) >> 2] | 0;
  FUNCTION_TABLE[($0 ? $0 : 5) | 0]($2, $4);
  wasm2js_trap();
 }
 
 function _ZN3std9panicking13panic_handler28_$u7b$$u7b$closure$u7d$$u7d$17hc45753d38c23abcfE($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0, $3 = 0, $23 = 0, $35 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  block : {
   $2 = HEAP32[$0 >> 2] | 0;
   $3 = HEAP32[($2 + 4 | 0) >> 2] | 0;
   if (!($3 & 1 | 0)) {
    break block
   }
   $2 = HEAP32[$2 >> 2] | 0;
   HEAP32[($1 + 4 | 0) >> 2] = $3 >>> 1 | 0;
   HEAP32[$1 >> 2] = $2;
   $23 = HEAP32[($0 + 4 | 0) >> 2] | 0;
   $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
   _ZN3std9panicking15panic_with_hook17hb44ff7a7db1d4a36E($1 | 0, 1050484 | 0, $23 | 0, HEAPU8[($0 + 8 | 0) >> 0] | 0 | 0, HEAPU8[($0 + 9 | 0) >> 0] | 0 | 0);
   wasm2js_trap();
  }
  HEAP32[$1 >> 2] = -2147483648;
  HEAP32[($1 + 12 | 0) >> 2] = $0;
  $35 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  _ZN3std9panicking15panic_with_hook17hb44ff7a7db1d4a36E($1 | 0, 1050512 | 0, $35 | 0, HEAPU8[($0 + 8 | 0) >> 0] | 0 | 0, HEAPU8[($0 + 9 | 0) >> 0] | 0 | 0);
  wasm2js_trap();
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17h2960490eaec09c54E($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $7 = 0, i64toi32_i32$4 = 0, $6 = 0, i64toi32_i32$3 = 0, $17 = 0, $16$hi = 0, $18$hi = 0, $8 = 0, $8$hi = 0, i64toi32_i32$2 = 0;
  $6 = 1;
  $7 = 4;
  block1 : {
   block : {
    i64toi32_i32$0 = 0;
    $16$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $18$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $16$hi;
    i64toi32_i32$1 = $18$hi;
    i64toi32_i32$1 = __wasm_i64_mul((($4 + $5 | 0) + -1 | 0) & (0 - $4 | 0) | 0 | 0, i64toi32_i32$0 | 0, $3 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $8 = i64toi32_i32$1;
    $8$hi = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 32;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $17 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $17 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    if (!$17) {
     break block
    }
    $3 = 0;
    break block1;
   }
   block2 : {
    i64toi32_i32$1 = $8$hi;
    $3 = $8;
    if ($3 >>> 0 <= (-2147483648 - $4 | 0) >>> 0) {
     break block2
    }
    $3 = 0;
    break block1;
   }
   block7 : {
    block6 : {
     block4 : {
      block3 : {
       if (!$1) {
        break block3
       }
       $7 = _RNvCs5QKde7ScR4H_7___rustc14___rust_realloc($2 | 0, Math_imul($5, $1) | 0, $4 | 0, $3 | 0) | 0;
       break block4;
      }
      block5 : {
       if ($3) {
        break block5
       }
       $7 = $4;
       break block6;
      }
      _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
      $7 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($3 | 0, $4 | 0) | 0;
     }
     if ($7) {
      break block6
     }
     HEAP32[($0 + 4 | 0) >> 2] = $4;
     break block7;
    }
    HEAP32[($0 + 4 | 0) >> 2] = $7;
    $6 = 0;
   }
   $7 = 8;
  }
  HEAP32[($0 + $7 | 0) >> 2] = $3;
  HEAP32[$0 >> 2] = $6;
 }
 
 function _ZN3std5alloc24default_alloc_error_hook17h6e0a53e9d2f3abaeE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP8[(0 + 1052320 | 0) >> 0] = 1;
 }
 
 function _ZN3std6thread5local18panic_access_error17h244585fb6eab2b51E($0) {
  $0 = $0 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, $1 = 0, i64toi32_i32$3 = 0, $12 = 0, $5 = 0, $7$hi = 0, $10$hi = 0, $11 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  $5 = $1;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = 6;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $12 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $12 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $7$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $10$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $7$hi;
  i64toi32_i32$0 = $12;
  i64toi32_i32$2 = $10$hi;
  i64toi32_i32$3 = $1 + 15 | 0;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  $11 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $5;
  HEAP32[i64toi32_i32$0 >> 2] = $11;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048900 | 0, $1 | 0, $0 | 0);
  wasm2js_trap();
 }
 
 function _ZN68_$LT$std__thread__local__AccessError$u20$as$u20$core__fmt__Debug$GT$3fmt17h9dcdc4c72eeff273E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  _ZN4core3fmt9Formatter12debug_struct17h6d68658d5a493288E($2 + 8 | 0 | 0, $1 | 0, 1050556 | 0, 11 | 0);
  $1 = _ZN4core3fmt8builders11DebugStruct6finish17ha06c88fdde62e2d2E($2 + 8 | 0 | 0) | 0;
  __stack_pointer = $2 + 16 | 0;
  return $1 | 0;
 }
 
 function _ZN3std9panicking15panic_with_hook17hb44ff7a7db1d4a36E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $6 = 0, i64toi32_i32$1 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  block1 : {
   block : {
    $6 = (_ZN3std9panicking11panic_count8increase17hec40e8e4ee32347eE(1 | 0) | 0) & 255 | 0;
    if (($6 | 0) == (2 | 0)) {
     break block
    }
    if (!($6 & 1 | 0)) {
     break block1
    }
    FUNCTION_TABLE[HEAP32[($1 + 24 | 0) >> 2] | 0 | 0]($5 + 8 | 0, $0);
    break block1;
   }
   $6 = HEAP32[(0 + 1052340 | 0) >> 2] | 0;
   if (($6 | 0) <= (-1 | 0)) {
    break block1
   }
   HEAP32[(0 + 1052340 | 0) >> 2] = $6 + 1 | 0;
   block3 : {
    block2 : {
     if (!(HEAP32[(0 + 1052344 | 0) >> 2] | 0)) {
      break block2
     }
     FUNCTION_TABLE[HEAP32[($1 + 20 | 0) >> 2] | 0 | 0]($5, $0);
     HEAP8[($5 + 29 | 0) >> 0] = $4;
     HEAP8[($5 + 28 | 0) >> 0] = $3;
     HEAP32[($5 + 24 | 0) >> 2] = $2;
     i64toi32_i32$1 = HEAP32[($5 + 4 | 0) >> 2] | 0;
     HEAP32[($5 + 16 | 0) >> 2] = HEAP32[$5 >> 2] | 0;
     HEAP32[($5 + 20 | 0) >> 2] = i64toi32_i32$1;
     FUNCTION_TABLE[HEAP32[((HEAP32[(0 + 1052348 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0 | 0](HEAP32[(0 + 1052344 | 0) >> 2] | 0, $5 + 16 | 0);
     break block3;
    }
    _ZN4core3ptr74drop_in_place$LT$core__option__Option$LT$alloc__vec__Vec$LT$u8$GT$$GT$$GT$17h953c7719105495e1E(-2147483648 | 0, $5 | 0);
   }
   HEAP32[(0 + 1052340 | 0) >> 2] = (HEAP32[(0 + 1052340 | 0) >> 2] | 0) + -1 | 0;
   HEAP8[(0 + 1052332 | 0) >> 0] = 0;
   if (!$3) {
    break block1
   }
   _RNvCs5QKde7ScR4H_7___rustc10rust_panic($0 | 0, $1 | 0);
   wasm2js_trap();
  }
  wasm2js_trap();
 }
 
 function _ZN3std9panicking11panic_count8increase17hec40e8e4ee32347eE($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0;
  $1 = 0;
  $2 = HEAP32[(0 + 1052336 | 0) >> 2] | 0;
  HEAP32[(0 + 1052336 | 0) >> 2] = $2 + 1 | 0;
  block : {
   if (($2 | 0) < (0 | 0)) {
    break block
   }
   $1 = 1;
   if (HEAPU8[(0 + 1052332 | 0) >> 0] | 0) {
    break block
   }
   HEAP8[(0 + 1052332 | 0) >> 0] = $0;
   HEAP32[(0 + 1052328 | 0) >> 2] = (HEAP32[(0 + 1052328 | 0) >> 2] | 0) + 1 | 0;
   $1 = 2;
  }
  return $1 | 0;
 }
 
 function _ZN4core3ptr74drop_in_place$LT$core__option__Option$LT$alloc__vec__Vec$LT$u8$GT$$GT$$GT$17h953c7719105495e1E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if (($0 | -2147483648 | 0 | 0) == (-2147483648 | 0)) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc($1 | 0, $0 | 0, 1 | 0);
  }
 }
 
 function _ZN42_$LT$$RF$T$u20$as$u20$core__fmt__Debug$GT$3fmt17h486f55f0065d2f82E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN43_$LT$bool$u20$as$u20$core__fmt__Display$GT$3fmt17h4c9cc61cff1c163fE(HEAP32[$0 >> 2] | 0 | 0, $1 | 0) | 0 | 0;
 }
 
 function _ZN4core3fmt5Write9write_fmt17hc11eb16c9bd02408E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  return _ZN4core3fmt5write17h8a3933e32b2d6a91E($0 | 0, 1050460 | 0, $1 | 0, $2 | 0) | 0 | 0;
 }
 
 function _ZN4core3ptr42drop_in_place$LT$alloc__string__String$GT$17hd8bb0d969dc84d34E($0) {
  $0 = $0 | 0;
  var $1 = 0;
  block : {
   $1 = HEAP32[$0 >> 2] | 0;
   if (!$1) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
  }
 }
 
 function _ZN4core3ptr71drop_in_place$LT$std__panicking__panic_handler__FormatStringPayload$GT$17h277ad6c190aac400E($0) {
  $0 = $0 | 0;
  var $1 = 0;
  block : {
   $1 = HEAP32[$0 >> 2] | 0;
   if (($1 | -2147483648 | 0 | 0) == (-2147483648 | 0)) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
  }
 }
 
 function _ZN4core5panic12PanicPayload6as_str17h48fb9d5ce40d3222E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[$0 >> 2] = 0;
 }
 
 function _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$10write_char17hc950aab5deb5eb09E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $3 = 0, $6 = 0, $5 = 0, $2 = 0, $7 = 0;
  $2 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  block1 : {
   block : {
    if ($1 >>> 0 >= 128 >>> 0) {
     break block
    }
    $3 = 1;
    break block1;
   }
   block2 : {
    if ($1 >>> 0 >= 2048 >>> 0) {
     break block2
    }
    $3 = 2;
    break block1;
   }
   $3 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
  }
  $4 = $2;
  block3 : {
   if ($3 >>> 0 <= ((HEAP32[$0 >> 2] | 0) - $4 | 0) >>> 0) {
    break block3
   }
   _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hfdc0e158016a3786E($0 | 0, $4 | 0, $3 | 0, 1 | 0, 1 | 0);
   $4 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  }
  $4 = (HEAP32[($0 + 4 | 0) >> 2] | 0) + $4 | 0;
  block6 : {
   block4 : {
    if ($1 >>> 0 < 128 >>> 0) {
     break block4
    }
    $5 = $1 & 63 | 0 | -128 | 0;
    $6 = $1 >>> 6 | 0;
    block5 : {
     if ($1 >>> 0 >= 2048 >>> 0) {
      break block5
     }
     HEAP8[($4 + 1 | 0) >> 0] = $5;
     HEAP8[$4 >> 0] = $6 | 192 | 0;
     break block6;
    }
    $7 = $1 >>> 12 | 0;
    $6 = $6 & 63 | 0 | -128 | 0;
    block7 : {
     if ($1 >>> 0 > 65535 >>> 0) {
      break block7
     }
     HEAP8[($4 + 2 | 0) >> 0] = $5;
     HEAP8[($4 + 1 | 0) >> 0] = $6;
     HEAP8[$4 >> 0] = $7 | 224 | 0;
     break block6;
    }
    HEAP8[($4 + 3 | 0) >> 0] = $5;
    HEAP8[($4 + 2 | 0) >> 0] = $6;
    HEAP8[($4 + 1 | 0) >> 0] = $7 & 63 | 0 | -128 | 0;
    HEAP8[$4 >> 0] = $1 >>> 18 | 0 | -16 | 0;
    break block6;
   }
   HEAP8[$4 >> 0] = $1;
  }
  HEAP32[($0 + 8 | 0) >> 2] = $3 + $2 | 0;
  return 0 | 0;
 }
 
 function _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$9write_str17h016b3e6048253d3cE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0;
  block : {
   $3 = HEAP32[($0 + 8 | 0) >> 2] | 0;
   if ($2 >>> 0 <= ((HEAP32[$0 >> 2] | 0) - $3 | 0) >>> 0) {
    break block
   }
   _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17hfdc0e158016a3786E($0 | 0, $3 | 0, $2 | 0, 1 | 0, 1 | 0);
   $3 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  }
  block1 : {
   if (!$2) {
    break block1
   }
   wasm2js_memory_copy((HEAP32[($0 + 4 | 0) >> 2] | 0) + $3 | 0, $1, $2);
  }
  HEAP32[($0 + 8 | 0) >> 2] = $3 + $2 | 0;
  return 0 | 0;
 }
 
 function _ZN86_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__fmt__Display$GT$3fmt17hc09e543b77e45d95E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN4core3fmt9Formatter9write_str17hebb2b1ebf80b0253E($1 | 0, HEAP32[$0 >> 2] | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0;
 }
 
 function _ZN89_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__fmt__Display$GT$3fmt17heb4624cd16326d0aE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if ((HEAP32[$0 >> 2] | 0 | 0) == (-2147483648 | 0)) {
    break block
   }
   return _ZN4core3fmt9Formatter9write_str17hebb2b1ebf80b0253E($1 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, HEAP32[($0 + 8 | 0) >> 2] | 0 | 0) | 0 | 0;
  }
  $0 = HEAP32[(HEAP32[($0 + 12 | 0) >> 2] | 0) >> 2] | 0;
  return _ZN4core3fmt5write17h8a3933e32b2d6a91E(HEAP32[$1 >> 2] | 0 | 0, HEAP32[($1 + 4 | 0) >> 2] | 0 | 0, HEAP32[$0 >> 2] | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0;
 }
 
 function _ZN8dlmalloc8dlmalloc17Dlmalloc$LT$A$GT$18insert_large_chunk17h05591b2b4b88c2c0E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0, $4 = 0, $5 = 0;
  $2 = 0;
  block : {
   if ($1 >>> 0 < 256 >>> 0) {
    break block
   }
   $2 = 31;
   if ($1 >>> 0 > 16777215 >>> 0) {
    break block
   }
   $2 = Math_clz32($1 >>> 8 | 0);
   $2 = ((($1 >>> (38 - $2 | 0) | 0) & 1 | 0) - ($2 << 1 | 0) | 0) + 62 | 0;
  }
  HEAP32[($0 + 16 | 0) >> 2] = 0;
  HEAP32[($0 + 20 | 0) >> 2] = 0;
  HEAP32[($0 + 28 | 0) >> 2] = $2;
  $3 = ($2 << 2 | 0) + 1051840 | 0;
  block1 : {
   $4 = 1 << $2 | 0;
   if ((HEAP32[(0 + 1052252 | 0) >> 2] | 0) & $4 | 0) {
    break block1
   }
   HEAP32[$3 >> 2] = $0;
   HEAP32[($0 + 24 | 0) >> 2] = $3;
   HEAP32[($0 + 12 | 0) >> 2] = $0;
   HEAP32[($0 + 8 | 0) >> 2] = $0;
   HEAP32[(0 + 1052252 | 0) >> 2] = HEAP32[(0 + 1052252 | 0) >> 2] | 0 | $4 | 0;
   return;
  }
  block4 : {
   block3 : {
    block2 : {
     $4 = HEAP32[$3 >> 2] | 0;
     if (((HEAP32[($4 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) != ($1 | 0)) {
      break block2
     }
     $2 = $4;
     break block3;
    }
    $3 = $1 << (($2 | 0) == (31 | 0) ? 0 : 25 - ($2 >>> 1 | 0) | 0) | 0;
    label : while (1) {
     $5 = $4 + (($3 >>> 29 | 0) & 4 | 0) | 0;
     $2 = HEAP32[($5 + 16 | 0) >> 2] | 0;
     if (!$2) {
      break block4
     }
     $3 = $3 << 1 | 0;
     $4 = $2;
     if (((HEAP32[($2 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) != ($1 | 0)) {
      continue label
     }
     break label;
    };
   }
   $3 = HEAP32[($2 + 8 | 0) >> 2] | 0;
   HEAP32[($3 + 12 | 0) >> 2] = $0;
   HEAP32[($2 + 8 | 0) >> 2] = $0;
   HEAP32[($0 + 24 | 0) >> 2] = 0;
   HEAP32[($0 + 12 | 0) >> 2] = $2;
   HEAP32[($0 + 8 | 0) >> 2] = $3;
   return;
  }
  HEAP32[($5 + 16 | 0) >> 2] = $0;
  HEAP32[($0 + 24 | 0) >> 2] = $4;
  HEAP32[($0 + 12 | 0) >> 2] = $0;
  HEAP32[($0 + 8 | 0) >> 2] = $0;
 }
 
 function _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$3get17h9dfb5af2d9d69a8dE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[($0 + 4 | 0) >> 2] = 1050568;
  HEAP32[$0 >> 2] = $1;
 }
 
 function _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$6as_str17h0ec005313dced4d5E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, $4 = 0;
  i64toi32_i32$2 = $1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $4 = i64toi32_i32$0;
  i64toi32_i32$0 = $0;
  HEAP32[i64toi32_i32$0 >> 2] = $4;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
 }
 
 function _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$8take_box17h191f69f185fcbba8E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0;
  $2 = HEAP32[($1 + 4 | 0) >> 2] | 0;
  $3 = HEAP32[$1 >> 2] | 0;
  _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
  block : {
   $1 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(8 | 0, 4 | 0) | 0;
   if ($1) {
    break block
   }
   _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E(4 | 0, 8 | 0);
   wasm2js_trap();
  }
  HEAP32[($1 + 4 | 0) >> 2] = $2;
  HEAP32[$1 >> 2] = $3;
  HEAP32[($0 + 4 | 0) >> 2] = 1050568;
  HEAP32[$0 >> 2] = $1;
 }
 
 function _ZN96_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__panic__PanicPayload$GT$3get17h38e2909e2ad1bc1aE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $4 = 0, $5 = 0;
  $2 = __stack_pointer - 32 | 0;
  __stack_pointer = $2;
  block : {
   if ((HEAP32[$1 >> 2] | 0 | 0) != (-2147483648 | 0)) {
    break block
   }
   $3 = HEAP32[($1 + 12 | 0) >> 2] | 0;
   $4 = ($2 + 20 | 0) + 8 | 0;
   HEAP32[$4 >> 2] = 0;
   i64toi32_i32$1 = $2;
   i64toi32_i32$0 = 1;
   HEAP32[($2 + 20 | 0) >> 2] = 0;
   HEAP32[($2 + 24 | 0) >> 2] = i64toi32_i32$0;
   $3 = HEAP32[$3 >> 2] | 0;
   _ZN4core3fmt5write17h8a3933e32b2d6a91E($2 + 20 | 0 | 0, 1050460 | 0, HEAP32[$3 >> 2] | 0 | 0, HEAP32[($3 + 4 | 0) >> 2] | 0 | 0) | 0;
   $3 = HEAP32[$4 >> 2] | 0;
   HEAP32[(($2 + 8 | 0) + 8 | 0) >> 2] = $3;
   i64toi32_i32$0 = HEAP32[($2 + 20 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[($2 + 24 | 0) >> 2] | 0;
   $5 = i64toi32_i32$0;
   i64toi32_i32$0 = $2;
   HEAP32[($2 + 8 | 0) >> 2] = $5;
   HEAP32[($2 + 12 | 0) >> 2] = i64toi32_i32$1;
   HEAP32[($1 + 8 | 0) >> 2] = $3;
   i64toi32_i32$0 = $1;
   HEAP32[$1 >> 2] = $5;
   HEAP32[($1 + 4 | 0) >> 2] = i64toi32_i32$1;
  }
  HEAP32[($0 + 4 | 0) >> 2] = 1050712;
  HEAP32[$0 >> 2] = $1;
  __stack_pointer = $2 + 32 | 0;
 }
 
 function _ZN96_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__panic__PanicPayload$GT$8take_box17h8e2d5423ef79faceE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $3 = 0, $2 = 0, $5 = 0, $4 = 0, $5$hi = 0, $61 = 0;
  $2 = __stack_pointer - 48 | 0;
  __stack_pointer = $2;
  block : {
   if ((HEAP32[$1 >> 2] | 0 | 0) != (-2147483648 | 0)) {
    break block
   }
   $3 = HEAP32[($1 + 12 | 0) >> 2] | 0;
   $4 = ($2 + 36 | 0) + 8 | 0;
   HEAP32[$4 >> 2] = 0;
   i64toi32_i32$1 = $2;
   i64toi32_i32$0 = 1;
   HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] = 0;
   HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] = i64toi32_i32$0;
   $3 = HEAP32[$3 >> 2] | 0;
   _ZN4core3fmt5write17h8a3933e32b2d6a91E(i64toi32_i32$1 + 36 | 0 | 0, 1050460 | 0, HEAP32[$3 >> 2] | 0 | 0, HEAP32[($3 + 4 | 0) >> 2] | 0 | 0) | 0;
   $3 = HEAP32[$4 >> 2] | 0;
   HEAP32[((i64toi32_i32$1 + 24 | 0) + 8 | 0) >> 2] = $3;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] | 0;
   $5 = i64toi32_i32$0;
   $5$hi = i64toi32_i32$1;
   i64toi32_i32$0 = $2;
   HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $5;
   HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$1;
   HEAP32[($1 + 8 | 0) >> 2] = $3;
   i64toi32_i32$0 = $1;
   HEAP32[i64toi32_i32$0 >> 2] = $5;
   HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  }
  i64toi32_i32$1 = HEAP32[$1 >> 2] | 0;
  i64toi32_i32$0 = HEAP32[($1 + 4 | 0) >> 2] | 0;
  $5 = i64toi32_i32$1;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = $1;
  i64toi32_i32$0 = 1;
  HEAP32[i64toi32_i32$1 >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  $3 = ($2 + 8 | 0) + 8 | 0;
  $1 = i64toi32_i32$1 + 8 | 0;
  HEAP32[$3 >> 2] = HEAP32[$1 >> 2] | 0;
  HEAP32[$1 >> 2] = 0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$1 = $2;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] = i64toi32_i32$0;
  _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
  block1 : {
   $1 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc(12 | 0, 4 | 0) | 0;
   if ($1) {
    break block1
   }
   _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E(4 | 0, 12 | 0);
   wasm2js_trap();
  }
  i64toi32_i32$0 = HEAP32[($2 + 8 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($2 + 12 | 0) >> 2] | 0;
  $61 = i64toi32_i32$0;
  i64toi32_i32$0 = $1;
  HEAP32[$1 >> 2] = $61;
  HEAP32[($1 + 4 | 0) >> 2] = i64toi32_i32$1;
  HEAP32[($1 + 8 | 0) >> 2] = HEAP32[$3 >> 2] | 0;
  HEAP32[($0 + 4 | 0) >> 2] = 1050712;
  HEAP32[$0 >> 2] = $1;
  __stack_pointer = $2 + 48 | 0;
 }
 
 function _ZN61_$LT$dlmalloc__sys__System$u20$as$u20$dlmalloc__Allocator$GT$5alloc17h5e0d28c009e5d62cE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $3 = 0;
  block1 : {
   block : {
    $2 = ($2 >>> 16 | 0) + (($2 & 65535 | 0 | 0) != (0 | 0)) | 0;
    $3 = __wasm_memory_grow($2 | 0);
    if (($3 | 0) != (-1 | 0)) {
     break block
    }
    $2 = 0;
    $4 = 0;
    break block1;
   }
   $4 = $2 << 16 | 0;
   $2 = $3 << 16 | 0;
   $4 = ($2 | 0) == (0 - $4 | 0 | 0) ? $4 + -16 | 0 : $4;
  }
  HEAP32[($0 + 8 | 0) >> 2] = 0;
  HEAP32[($0 + 4 | 0) >> 2] = $4;
  HEAP32[$0 >> 2] = $2;
 }
 
 function _ZN9hashbrown3raw11Fallibility17capacity_overflow17h8f507abfa1292136E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if (!$1) {
    break block
   }
   _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050728 | 0, 57 | 0, 1050756 | 0);
   wasm2js_trap();
  }
  HEAP32[$0 >> 2] = 0;
 }
 
 function _ZN9hashbrown3raw11Fallibility9alloc_err17h2c2bc123843b03b6E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  block : {
   if (!$1) {
    break block
   }
   _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E($2 | 0, $3 | 0);
   wasm2js_trap();
  }
  HEAP32[($0 + 4 | 0) >> 2] = $3;
  HEAP32[$0 >> 2] = $2;
 }
 
 function _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  _RNvCs5QKde7ScR4H_7___rustc26___rust_alloc_error_handler($1 | 0, $0 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3fmt5Write9write_fmt17h50ea9de0bbf4769cE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  return _ZN4core3fmt5write17h8a3933e32b2d6a91E($0 | 0, 1050780 | 0, $1 | 0, $2 | 0) | 0 | 0;
 }
 
 function _ZN4core3ptr42drop_in_place$LT$alloc__string__String$GT$17hf93247b5f5ddbcfaE($0) {
  $0 = $0 | 0;
  var $1 = 0;
  block : {
   $1 = HEAP32[$0 >> 2] | 0;
   if (!$1) {
    break block
   }
   _RNvCs5QKde7ScR4H_7___rustc14___rust_dealloc(HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $1 | 0, 1 | 0);
  }
 }
 
 function _ZN53_$LT$core__fmt__Error$u20$as$u20$core__fmt__Debug$GT$3fmt17h25009d44b1b6377aE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN4core3fmt9Formatter9write_str17hebb2b1ebf80b0253E($1 | 0, 1050772 | 0, 5 | 0) | 0 | 0;
 }
 
 function _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$10write_char17hc950aab5deb5eb09E_87($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $3 = 0, $6 = 0, $5 = 0, $2 = 0, $7 = 0;
  $2 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  block1 : {
   block : {
    if ($1 >>> 0 >= 128 >>> 0) {
     break block
    }
    $3 = 1;
    break block1;
   }
   block2 : {
    if ($1 >>> 0 >= 2048 >>> 0) {
     break block2
    }
    $3 = 2;
    break block1;
   }
   $3 = $1 >>> 0 < 65536 >>> 0 ? 3 : 4;
  }
  $4 = $2;
  block3 : {
   if ($3 >>> 0 <= ((HEAP32[$0 >> 2] | 0) - $4 | 0) >>> 0) {
    break block3
   }
   _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17he4304346624f94d3E($0 | 0, $4 | 0, $3 | 0);
   $4 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  }
  $4 = (HEAP32[($0 + 4 | 0) >> 2] | 0) + $4 | 0;
  block6 : {
   block4 : {
    if ($1 >>> 0 < 128 >>> 0) {
     break block4
    }
    $5 = $1 & 63 | 0 | -128 | 0;
    $6 = $1 >>> 6 | 0;
    block5 : {
     if ($1 >>> 0 >= 2048 >>> 0) {
      break block5
     }
     HEAP8[($4 + 1 | 0) >> 0] = $5;
     HEAP8[$4 >> 0] = $6 | 192 | 0;
     break block6;
    }
    $7 = $1 >>> 12 | 0;
    $6 = $6 & 63 | 0 | -128 | 0;
    block7 : {
     if ($1 >>> 0 > 65535 >>> 0) {
      break block7
     }
     HEAP8[($4 + 2 | 0) >> 0] = $5;
     HEAP8[($4 + 1 | 0) >> 0] = $6;
     HEAP8[$4 >> 0] = $7 | 224 | 0;
     break block6;
    }
    HEAP8[($4 + 3 | 0) >> 0] = $5;
    HEAP8[($4 + 2 | 0) >> 0] = $6;
    HEAP8[($4 + 1 | 0) >> 0] = $7 & 63 | 0 | -128 | 0;
    HEAP8[$4 >> 0] = $1 >>> 18 | 0 | -16 | 0;
    break block6;
   }
   HEAP8[$4 >> 0] = $1;
  }
  HEAP32[($0 + 8 | 0) >> 2] = $3 + $2 | 0;
  return 0 | 0;
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17he4304346624f94d3E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $17 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  block : {
   $1 = $2 + $1 | 0;
   if ($1 >>> 0 >= $2 >>> 0) {
    break block
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(0 | 0, 0 | 0);
   wasm2js_trap();
  }
  $2 = HEAP32[$0 >> 2] | 0;
  $17 = $2;
  $2 = $2 << 1 | 0;
  $2 = $1 >>> 0 > $2 >>> 0 ? $1 : $2;
  $2 = $2 >>> 0 > 8 >>> 0 ? $2 : 8;
  _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hf4e303f260475484E($3 + 4 | 0 | 0, $17 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0, $2 | 0);
  block1 : {
   if ((HEAP32[($3 + 4 | 0) >> 2] | 0 | 0) != (1 | 0)) {
    break block1
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0, HEAP32[($3 + 12 | 0) >> 2] | 0 | 0);
   wasm2js_trap();
  }
  $1 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[$0 >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $1;
  __stack_pointer = $3 + 16 | 0;
 }
 
 function _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$9write_str17h016b3e6048253d3cE_89($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0;
  block : {
   $3 = HEAP32[($0 + 8 | 0) >> 2] | 0;
   if ($2 >>> 0 <= ((HEAP32[$0 >> 2] | 0) - $3 | 0) >>> 0) {
    break block
   }
   _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$7reserve21do_reserve_and_handle17he4304346624f94d3E($0 | 0, $3 | 0, $2 | 0);
   $3 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  }
  block1 : {
   if (!$2) {
    break block1
   }
   wasm2js_memory_copy((HEAP32[($0 + 4 | 0) >> 2] | 0) + $3 | 0, $1, $2);
  }
  HEAP32[($0 + 8 | 0) >> 2] = $3 + $2 | 0;
  return 0 | 0;
 }
 
 function _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if (!$0) {
    break block
   }
   _ZN5alloc5alloc18handle_alloc_error17h6f1f2cbeb5405317E($0 | 0, $1 | 0);
   wasm2js_trap();
  }
  _ZN5alloc7raw_vec17capacity_overflow17haeb652f2b2f086fbE();
  wasm2js_trap();
 }
 
 function _ZN5alloc7raw_vec20RawVecInner$LT$A$GT$11finish_grow17hf4e303f260475484E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  block1 : {
   block : {
    if (($3 | 0) >= (0 | 0)) {
     break block
    }
    $1 = 1;
    $2 = 4;
    $3 = 0;
    break block1;
   }
   block6 : {
    block5 : {
     block3 : {
      block2 : {
       if (!$1) {
        break block2
       }
       $1 = _RNvCs5QKde7ScR4H_7___rustc14___rust_realloc($2 | 0, $1 | 0, 1 | 0, $3 | 0) | 0;
       break block3;
      }
      block4 : {
       if ($3) {
        break block4
       }
       $1 = 1;
       break block5;
      }
      _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
      $1 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($3 | 0, 1 | 0) | 0;
     }
     if ($1) {
      break block5
     }
     $1 = 1;
     HEAP32[($0 + 4 | 0) >> 2] = 1;
     break block6;
    }
    HEAP32[($0 + 4 | 0) >> 2] = $1;
    $1 = 0;
   }
   $2 = 8;
  }
  HEAP32[($0 + $2 | 0) >> 2] = $3;
  HEAP32[$0 >> 2] = $1;
 }
 
 function _ZN5alloc3fmt6format12format_inner17h32c4432df66cb685E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $6 = 0, $3 = 0, $7 = 0, $8 = 0, i64toi32_i32$0 = 0, $5 = 0, i64toi32_i32$1 = 0, $107 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  block9 : {
   block6 : {
    block8 : {
     block7 : {
      block2 : {
       block1 : {
        block : {
         if (!($2 & 1 | 0)) {
          break block
         }
         $4 = $2 >>> 1 | 0;
         break block1;
        }
        $4 = HEAPU8[$1 >> 0] | 0;
        if (!$4) {
         break block2
        }
        $5 = 0;
        $6 = $1;
        $7 = 0;
        label : while (1) {
         $6 = $6 + 1 | 0;
         block5 : {
          block3 : {
           if (($4 << 24 >> 24 | 0) > (-1 | 0)) {
            break block3
           }
           block4 : {
            if (($4 & 255 | 0 | 0) != (128 | 0)) {
             break block4
            }
            $4 = HEAPU8[$6 >> 0] | 0 | ((HEAPU8[($6 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
            $7 = $7 + $4 | 0;
            $6 = ($6 + $4 | 0) + 2 | 0;
            break block5;
           }
           $8 = __wasm_rotl_i32($4 & 3 | 0 | 0, 24 | 0) | 0;
           $6 = (($6 + ((($8 << 5 | 0) & 1073741824 | 0 | (($8 & 16777216 | 0) << 7 | 0 | ($8 & 536870912 | 0) | 0) | 0) >>> 29 | 0) | 0) + (($4 >>> 1 | 0) & 2 | 0) | 0) + (($4 >>> 2 | 0) & 2 | 0) | 0;
           $5 = !$7 | $5 | 0;
           break block5;
          }
          $4 = $4 & 255 | 0;
          $6 = $6 + $4 | 0;
          $7 = $7 + $4 | 0;
         }
         $4 = HEAPU8[$6 >> 0] | 0;
         if ($4) {
          continue label
         }
         break label;
        };
        $4 = 0;
        if ($5 & $7 >>> 0 < 16 >>> 0 | 0) {
         break block1
        }
        $8 = 0;
        $4 = $7 << 1 | 0;
        if (($4 | 0) < (0 | 0)) {
         break block6
        }
       }
       if ($4) {
        break block7
       }
      }
      $6 = 1;
      $4 = 0;
      break block8;
     }
     _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
     $8 = 1;
     $6 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($4 | 0, 1 | 0) | 0;
     if (!$6) {
      break block6
     }
    }
    HEAP32[($3 + 8 | 0) >> 2] = 0;
    HEAP32[($3 + 4 | 0) >> 2] = $6;
    HEAP32[$3 >> 2] = $4;
    if (!(_ZN4core3fmt5write17h8a3933e32b2d6a91E($3 | 0, 1050780 | 0, $1 | 0, $2 | 0) | 0)) {
     break block9
    }
    _ZN4core6result13unwrap_failed17h0f3535ea1a218143E(1050820 | 0, 86 | 0, $3 + 15 | 0 | 0, 1050804 | 0, 1050908 | 0);
    wasm2js_trap();
   }
   _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE($8 | 0, $4 | 0);
   wasm2js_trap();
  }
  i64toi32_i32$0 = HEAP32[$3 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $107 = i64toi32_i32$0;
  i64toi32_i32$0 = $0;
  HEAP32[i64toi32_i32$0 >> 2] = $107;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = HEAP32[($3 + 8 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
 }
 
 function _ZN5alloc7raw_vec17capacity_overflow17haeb652f2b2f086fbE() {
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1050924 | 0, 35 | 0, 1050944 | 0);
  wasm2js_trap();
 }
 
 function _ZN60_$LT$alloc__string__String$u20$as$u20$core__clone__Clone$GT$5clone17h513f30159ab4c799E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $3 = 0, $2 = 0;
  $2 = HEAP32[($1 + 4 | 0) >> 2] | 0;
  block2 : {
   block1 : {
    block : {
     $1 = HEAP32[($1 + 8 | 0) >> 2] | 0;
     if ($1) {
      break block
     }
     $3 = 1;
     break block1;
    }
    _RNvCs5QKde7ScR4H_7___rustc35___rust_no_alloc_shim_is_unstable_v2();
    $3 = _RNvCs5QKde7ScR4H_7___rustc12___rust_alloc($1 | 0, 1 | 0) | 0;
    if (!$3) {
     break block2
    }
   }
   block3 : {
    if (!$1) {
     break block3
    }
    wasm2js_memory_copy($3, $2, $1);
   }
   HEAP32[($0 + 8 | 0) >> 2] = $1;
   HEAP32[($0 + 4 | 0) >> 2] = $3;
   HEAP32[$0 >> 2] = $1;
   return;
  }
  _ZN5alloc7raw_vec12handle_error17h4e2f08c15e85715cE(1 | 0, $1 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3fmt5write17h8a3933e32b2d6a91E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $5 = 0, $8 = 0, $4 = 0, $7 = 0, $9 = 0, $11 = 0, $6 = 0, $10 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  block2 : {
   block1 : {
    block : {
     if ($3 & 1 | 0) {
      break block
     }
     $5 = HEAPU8[$2 >> 0] | 0;
     if ($5) {
      break block1
     }
     $5 = 0;
     break block2;
    }
    $5 = FUNCTION_TABLE[HEAP32[($1 + 12 | 0) >> 2] | 0 | 0]($0, $2, $3 >>> 1 | 0) | 0;
    break block2;
   }
   $6 = HEAP32[($1 + 12 | 0) >> 2] | 0;
   $7 = 0;
   label : while (1) {
    $8 = $2 + 1 | 0;
    block8 : {
     block5 : {
      block6 : {
       block4 : {
        block3 : {
         if (($5 << 24 >> 24 | 0) > (-1 | 0)) {
          break block3
         }
         $9 = $5 & 255 | 0;
         if (($9 | 0) == (128 | 0)) {
          break block4
         }
         if (($9 | 0) != (192 | 0)) {
          break block5
         }
         HEAP32[($4 + 4 | 0) >> 2] = $1;
         HEAP32[$4 >> 2] = $0;
         HEAP32[($4 + 8 | 0) >> 2] = 1610612768;
         HEAP32[($4 + 12 | 0) >> 2] = 0;
         $5 = $3 + ($7 << 3 | 0) | 0;
         if (!(FUNCTION_TABLE[HEAP32[($5 + 4 | 0) >> 2] | 0 | 0](HEAP32[$5 >> 2] | 0, $4) | 0)) {
          break block6
         }
         $5 = 1;
         break block2;
        }
        block7 : {
         $5 = $5 & 255 | 0;
         if (FUNCTION_TABLE[$6 | 0]($0, $8, $5) | 0) {
          break block7
         }
         $2 = $8 + $5 | 0;
         break block8;
        }
        $5 = 1;
        break block2;
       }
       block9 : {
        $5 = $2 + 3 | 0;
        $2 = HEAPU8[($2 + 1 | 0) >> 0] | 0 | ((HEAPU8[($2 + 2 | 0) >> 0] | 0) << 8 | 0) | 0;
        if (FUNCTION_TABLE[$6 | 0]($0, $5, $2) | 0) {
         break block9
        }
        $2 = $5 + $2 | 0;
        break block8;
       }
       $5 = 1;
       break block2;
      }
      $7 = $7 + 1 | 0;
      $2 = $8;
      break block8;
     }
     $10 = 1610612768;
     block10 : {
      if (!($5 & 1 | 0)) {
       break block10
      }
      $8 = $2 + 5 | 0;
      $10 = HEAPU8[($2 + 1 | 0) >> 0] | 0 | ((HEAPU8[($2 + 2 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($2 + 3 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($2 + 4 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
     }
     $9 = 0;
     block12 : {
      block11 : {
       if ($5 & 2 | 0) {
        break block11
       }
       $11 = 0;
       $2 = $8;
       break block12;
      }
      $2 = $8 + 2 | 0;
      $11 = HEAPU8[$8 >> 0] | 0 | ((HEAPU8[($8 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
     }
     block14 : {
      block13 : {
       if ($5 & 4 | 0) {
        break block13
       }
       $8 = $2;
       break block14;
      }
      $8 = $2 + 2 | 0;
      $9 = HEAPU8[$2 >> 0] | 0 | ((HEAPU8[($2 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
     }
     block16 : {
      block15 : {
       if ($5 & 8 | 0) {
        break block15
       }
       $2 = $8;
       break block16;
      }
      $2 = $8 + 2 | 0;
      $7 = HEAPU8[$8 >> 0] | 0 | ((HEAPU8[($8 + 1 | 0) >> 0] | 0) << 8 | 0) | 0;
     }
     block17 : {
      if (!($5 & 16 | 0)) {
       break block17
      }
      $11 = HEAPU16[(($3 + (($11 & 65535 | 0) << 3 | 0) | 0) + 4 | 0) >> 1] | 0;
     }
     block18 : {
      if (!($5 & 32 | 0)) {
       break block18
      }
      $9 = HEAPU16[(($3 + (($9 & 65535 | 0) << 3 | 0) | 0) + 4 | 0) >> 1] | 0;
     }
     HEAP16[($4 + 14 | 0) >> 1] = $9;
     HEAP16[($4 + 12 | 0) >> 1] = $11;
     HEAP32[($4 + 8 | 0) >> 2] = $10;
     HEAP32[($4 + 4 | 0) >> 2] = $1;
     HEAP32[$4 >> 2] = $0;
     block19 : {
      $5 = $3 + ($7 << 3 | 0) | 0;
      if (!(FUNCTION_TABLE[HEAP32[($5 + 4 | 0) >> 2] | 0 | 0](HEAP32[$5 >> 2] | 0, $4) | 0)) {
       break block19
      }
      $5 = 1;
      break block2;
     }
     $7 = $7 + 1 | 0;
    }
    $5 = HEAPU8[$2 >> 0] | 0;
    if ($5) {
     continue label
    }
    break label;
   };
   $5 = 0;
  }
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function _ZN42_$LT$$RF$T$u20$as$u20$core__fmt__Debug$GT$3fmt17hbb6739267e179261E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return FUNCTION_TABLE[HEAP32[((HEAP32[($0 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$0 >> 2] | 0, $1) | 0 | 0;
 }
 
 function _ZN4core3fmt9Formatter12pad_integral17hc160c494f42f5c87E($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var $10 = 0, $12 = 0, $9 = 0, $11 = 0, $6 = 0, $7 = 0, $8 = 0, $13 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $14 = 0, $14$hi = 0;
  block1 : {
   block : {
    if ($1) {
     break block
    }
    $6 = $5 + 1 | 0;
    $7 = HEAP32[($0 + 8 | 0) >> 2] | 0;
    $8 = 45;
    break block1;
   }
   $7 = HEAP32[($0 + 8 | 0) >> 2] | 0;
   $1 = $7 & 2097152 | 0;
   $8 = $1 ? 43 : 1114112;
   $6 = ($1 >>> 21 | 0) + $5 | 0;
  }
  block3 : {
   block2 : {
    if ($7 & 8388608 | 0) {
     break block2
    }
    $2 = 0;
    break block3;
   }
   block5 : {
    block4 : {
     if ($3 >>> 0 < 16 >>> 0) {
      break block4
     }
     $1 = _ZN4core3str5count14do_count_chars17h53eda46924511659E($2 | 0, $3 | 0) | 0;
     break block5;
    }
    block6 : {
     if ($3) {
      break block6
     }
     $1 = 0;
     break block5;
    }
    $9 = $3 & 3 | 0;
    block8 : {
     block7 : {
      if ($3 >>> 0 >= 4 >>> 0) {
       break block7
      }
      $10 = 0;
      $1 = 0;
      break block8;
     }
     $11 = $3 & 12 | 0;
     $10 = 0;
     $1 = 0;
     label : while (1) {
      $12 = $2 + $10 | 0;
      $1 = ((($1 + ((HEAP8[$12 >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($12 + 1 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($12 + 2 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($12 + 3 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
      $10 = $10 + 4 | 0;
      if (($11 | 0) != ($10 | 0)) {
       continue label
      }
      break label;
     };
    }
    if (!$9) {
     break block5
    }
    $12 = $2 + $10 | 0;
    label1 : while (1) {
     $1 = $1 + ((HEAP8[$12 >> 0] | 0 | 0) > (-65 | 0)) | 0;
     $12 = $12 + 1 | 0;
     $9 = $9 + -1 | 0;
     if ($9) {
      continue label1
     }
     break label1;
    };
   }
   $6 = $1 + $6 | 0;
  }
  block15 : {
   block9 : {
    $11 = HEAPU16[($0 + 12 | 0) >> 1] | 0;
    if ($6 >>> 0 >= $11 >>> 0) {
     break block9
    }
    block16 : {
     block14 : {
      block10 : {
       if ($7 & 16777216 | 0) {
        break block10
       }
       $13 = $11 - $6 | 0;
       $1 = 0;
       $11 = 0;
       block11 : {
        block13 : {
         switch (($7 >>> 29 | 0) & 3 | 0 | 0) {
         case 1:
         case 3:
          $11 = $13;
          break block11;
         case 2:
          break block13;
         default:
          break block11;
         };
        }
        $11 = ($13 & 65534 | 0) >>> 1 | 0;
       }
       $6 = $7 & 2097151 | 0;
       $9 = HEAP32[($0 + 4 | 0) >> 2] | 0;
       $10 = HEAP32[$0 >> 2] | 0;
       label2 : while (1) {
        if (($1 & 65535 | 0) >>> 0 >= ($11 & 65535 | 0) >>> 0) {
         break block14
        }
        $12 = 1;
        $1 = $1 + 1 | 0;
        if (!(FUNCTION_TABLE[HEAP32[($9 + 16 | 0) >> 2] | 0 | 0]($10, $6) | 0)) {
         continue label2
        }
        break block15;
       };
      }
      i64toi32_i32$0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[($0 + 12 | 0) >> 2] | 0;
      $14 = i64toi32_i32$0;
      $14$hi = i64toi32_i32$1;
      HEAP32[($0 + 8 | 0) >> 2] = i64toi32_i32$0 & -1612709888 | 0 | 536870960 | 0;
      $12 = 1;
      $10 = HEAP32[$0 >> 2] | 0;
      $9 = HEAP32[($0 + 4 | 0) >> 2] | 0;
      if (_ZN4core3fmt9Formatter12pad_integral12write_prefix17hbac726506c465456E($10 | 0, $9 | 0, $8 | 0, $2 | 0, $3 | 0) | 0) {
       break block15
      }
      $1 = 0;
      $2 = ($11 - $6 | 0) & 65535 | 0;
      label3 : while (1) {
       if (($1 & 65535 | 0) >>> 0 >= $2 >>> 0) {
        break block16
       }
       $12 = 1;
       $1 = $1 + 1 | 0;
       if (!(FUNCTION_TABLE[HEAP32[($9 + 16 | 0) >> 2] | 0 | 0]($10, 48) | 0)) {
        continue label3
       }
       break block15;
      };
     }
     $12 = 1;
     if (_ZN4core3fmt9Formatter12pad_integral12write_prefix17hbac726506c465456E($10 | 0, $9 | 0, $8 | 0, $2 | 0, $3 | 0) | 0) {
      break block15
     }
     if (FUNCTION_TABLE[HEAP32[($9 + 12 | 0) >> 2] | 0 | 0]($10, $4, $5) | 0) {
      break block15
     }
     $1 = 0;
     $0 = ($13 - $11 | 0) & 65535 | 0;
     label4 : while (1) {
      $2 = $1 & 65535 | 0;
      $12 = $2 >>> 0 < $0 >>> 0;
      if ($2 >>> 0 >= $0 >>> 0) {
       break block15
      }
      $1 = $1 + 1 | 0;
      if (!(FUNCTION_TABLE[HEAP32[($9 + 16 | 0) >> 2] | 0 | 0]($10, $6) | 0)) {
       continue label4
      }
      break block15;
     };
    }
    $12 = 1;
    if (FUNCTION_TABLE[HEAP32[($9 + 12 | 0) >> 2] | 0 | 0]($10, $4, $5) | 0) {
     break block15
    }
    i64toi32_i32$1 = $14$hi;
    i64toi32_i32$0 = $0;
    HEAP32[($0 + 8 | 0) >> 2] = $14;
    HEAP32[($0 + 12 | 0) >> 2] = i64toi32_i32$1;
    return 0 | 0;
   }
   $12 = 1;
   $1 = HEAP32[$0 >> 2] | 0;
   $10 = HEAP32[($0 + 4 | 0) >> 2] | 0;
   if (_ZN4core3fmt9Formatter12pad_integral12write_prefix17hbac726506c465456E($1 | 0, $10 | 0, $8 | 0, $2 | 0, $3 | 0) | 0) {
    break block15
   }
   $12 = FUNCTION_TABLE[HEAP32[($10 + 12 | 0) >> 2] | 0 | 0]($1, $4, $5) | 0;
  }
  return $12 | 0;
 }
 
 function _ZN42_$LT$str$u20$as$u20$core__fmt__Display$GT$3fmt17h2c2643320af0bbc5E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  return _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($2 | 0, $0 | 0, $1 | 0) | 0 | 0;
 }
 
 function _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $8 = 0, $5 = 0, $7 = 0, $4 = 0, $6 = 0, $3 = 0, $9 = 0;
  block18 : {
   block : {
    $3 = HEAP32[($0 + 8 | 0) >> 2] | 0;
    if (!($3 & 402653184 | 0)) {
     break block
    }
    block5 : {
     block9 : {
      block3 : {
       block2 : {
        block1 : {
         if (!($3 & 268435456 | 0)) {
          break block1
         }
         $4 = HEAPU16[($0 + 14 | 0) >> 1] | 0;
         if ($4) {
          break block2
         }
         $2 = 0;
         break block3;
        }
        block4 : {
         if ($2 >>> 0 < 16 >>> 0) {
          break block4
         }
         $5 = _ZN4core3str5count14do_count_chars17h53eda46924511659E($1 | 0, $2 | 0) | 0;
         break block5;
        }
        block6 : {
         if ($2) {
          break block6
         }
         $5 = 0;
         break block5;
        }
        $6 = $2 & 3 | 0;
        block8 : {
         block7 : {
          if ($2 >>> 0 >= 4 >>> 0) {
           break block7
          }
          $7 = 0;
          $5 = 0;
          break block8;
         }
         $4 = $2 & 12 | 0;
         $7 = 0;
         $5 = 0;
         label : while (1) {
          $8 = $1 + $7 | 0;
          $5 = ((($5 + ((HEAP8[$8 >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($8 + 1 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($8 + 2 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($8 + 3 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
          $7 = $7 + 4 | 0;
          if (($4 | 0) != ($7 | 0)) {
           continue label
          }
          break label;
         };
        }
        if (!$6) {
         break block5
        }
        $8 = $1 + $7 | 0;
        label1 : while (1) {
         $5 = $5 + ((HEAP8[$8 >> 0] | 0 | 0) > (-65 | 0)) | 0;
         $8 = $8 + 1 | 0;
         $6 = $6 + -1 | 0;
         if ($6) {
          continue label1
         }
         break block5;
        };
       }
       $6 = $1 + $2 | 0;
       $2 = 0;
       $8 = $1;
       $7 = $4;
       label2 : while (1) {
        $5 = $8;
        if (($5 | 0) == ($6 | 0)) {
         break block9
        }
        block11 : {
         block10 : {
          $8 = HEAP8[$5 >> 0] | 0;
          if (($8 | 0) <= (-1 | 0)) {
           break block10
          }
          $8 = $5 + 1 | 0;
          break block11;
         }
         block12 : {
          if ($8 >>> 0 >= -32 >>> 0) {
           break block12
          }
          $8 = $5 + 2 | 0;
          break block11;
         }
         block13 : {
          if ($8 >>> 0 >= -16 >>> 0) {
           break block13
          }
          $8 = $5 + 3 | 0;
          break block11;
         }
         $8 = $5 + 4 | 0;
        }
        $2 = ($8 - $5 | 0) + $2 | 0;
        $7 = $7 + -1 | 0;
        if ($7) {
         continue label2
        }
        break label2;
       };
      }
      $7 = 0;
     }
     $5 = $4 - $7 | 0;
    }
    $8 = HEAPU16[($0 + 12 | 0) >> 1] | 0;
    if ($5 >>> 0 >= $8 >>> 0) {
     break block
    }
    $9 = $8 - $5 | 0;
    $5 = 0;
    $4 = 0;
    block14 : {
     block16 : {
      switch (($3 >>> 29 | 0) & 3 | 0 | 0) {
      case 1:
       $4 = $9;
       break block14;
      case 2:
       break block16;
      default:
       break block14;
      };
     }
     $4 = ($9 & 65534 | 0) >>> 1 | 0;
    }
    $6 = $3 & 2097151 | 0;
    $7 = HEAP32[($0 + 4 | 0) >> 2] | 0;
    $0 = HEAP32[$0 >> 2] | 0;
    block17 : {
     label3 : while (1) {
      if (($5 & 65535 | 0) >>> 0 >= ($4 & 65535 | 0) >>> 0) {
       break block17
      }
      $8 = 1;
      $5 = $5 + 1 | 0;
      if (FUNCTION_TABLE[HEAP32[($7 + 16 | 0) >> 2] | 0 | 0]($0, $6) | 0) {
       break block18
      }
      continue label3;
     };
    }
    $8 = 1;
    if (FUNCTION_TABLE[HEAP32[($7 + 12 | 0) >> 2] | 0 | 0]($0, $1, $2) | 0) {
     break block18
    }
    $5 = 0;
    $2 = ($9 - $4 | 0) & 65535 | 0;
    label4 : while (1) {
     $4 = $5 & 65535 | 0;
     $8 = $4 >>> 0 < $2 >>> 0;
     if ($4 >>> 0 >= $2 >>> 0) {
      break block18
     }
     $5 = $5 + 1 | 0;
     if (FUNCTION_TABLE[HEAP32[($7 + 16 | 0) >> 2] | 0 | 0]($0, $6) | 0) {
      break block18
     }
     continue label4;
    };
   }
   $8 = FUNCTION_TABLE[HEAP32[((HEAP32[($0 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$0 >> 2] | 0, $1, $2) | 0;
  }
  return $8 | 0;
 }
 
 function _ZN43_$LT$bool$u20$as$u20$core__fmt__Display$GT$3fmt17h4c9cc61cff1c163fE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  block : {
   if (HEAPU8[$0 >> 0] | 0) {
    break block
   }
   return _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($1 | 0, 1051216 | 0, 5 | 0) | 0 | 0;
  }
  return _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($1 | 0, 1051221 | 0, 4 | 0) | 0 | 0;
 }
 
 function _ZN43_$LT$char$u20$as$u20$core__fmt__Display$GT$3fmt17h96ef625e78ca39a1E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $4 = 0, $3 = 0, $5 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  $0 = HEAP32[$0 >> 2] | 0;
  block1 : {
   block : {
    if ((HEAPU8[($1 + 11 | 0) >> 0] | 0) & 24 | 0) {
     break block
    }
    $0 = FUNCTION_TABLE[HEAP32[((HEAP32[($1 + 4 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0 | 0](HEAP32[$1 >> 2] | 0, $0) | 0;
    break block1;
   }
   HEAP32[($2 + 12 | 0) >> 2] = 0;
   block4 : {
    block2 : {
     if ($0 >>> 0 < 128 >>> 0) {
      break block2
     }
     $3 = $0 & 63 | 0 | -128 | 0;
     $4 = $0 >>> 6 | 0;
     block3 : {
      if ($0 >>> 0 >= 2048 >>> 0) {
       break block3
      }
      HEAP8[($2 + 13 | 0) >> 0] = $3;
      HEAP8[($2 + 12 | 0) >> 0] = $4 | 192 | 0;
      $0 = 2;
      break block4;
     }
     $5 = $0 >>> 12 | 0;
     $4 = $4 & 63 | 0 | -128 | 0;
     block5 : {
      if ($0 >>> 0 > 65535 >>> 0) {
       break block5
      }
      HEAP8[($2 + 14 | 0) >> 0] = $3;
      HEAP8[($2 + 13 | 0) >> 0] = $4;
      HEAP8[($2 + 12 | 0) >> 0] = $5 | 224 | 0;
      $0 = 3;
      break block4;
     }
     HEAP8[($2 + 15 | 0) >> 0] = $3;
     HEAP8[($2 + 14 | 0) >> 0] = $4;
     HEAP8[($2 + 13 | 0) >> 0] = $5 & 63 | 0 | -128 | 0;
     HEAP8[($2 + 12 | 0) >> 0] = $0 >>> 18 | 0 | -16 | 0;
     $0 = 4;
     break block4;
    }
    HEAP8[($2 + 12 | 0) >> 0] = $0;
    $0 = 1;
   }
   $0 = _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($1 | 0, $2 + 12 | 0 | 0, $0 | 0) | 0;
  }
  __stack_pointer = $2 + 16 | 0;
  return $0 | 0;
 }
 
 function _ZN44_$LT$$RF$T$u20$as$u20$core__fmt__Display$GT$3fmt17h6011d1b40ffa7fc2E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN4core3fmt9Formatter3pad17h74a340fd872752aaE($1 | 0, HEAP32[$0 >> 2] | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0;
 }
 
 function _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$10_fmt_inner17h689fb7c6c0da79c3E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $7 = 0, $3 = 0, $10 = 0, $6 = 0, $9 = 0, $5 = 0, $8 = 0, $11 = 0;
  $3 = $0;
  $4 = $2;
  block : {
   if ($3 >>> 0 < 1e3 >>> 0) {
    break block
   }
   $5 = $1 + -4 | 0;
   $6 = 0;
   $7 = $3;
   block5 : {
    block4 : {
     label : while (1) {
      $3 = ($7 >>> 0) / (1e4 >>> 0) | 0;
      $8 = $7 - Math_imul($3, 1e4) | 0;
      $9 = (($8 & 65535 | 0) >>> 0) / (100 >>> 0) | 0;
      block2 : {
       block1 : {
        $4 = $2 + $6 | 0;
        if (($4 + -4 | 0) >>> 0 >= $2 >>> 0) {
         break block1
        }
        $10 = $5 + $2 | 0;
        $11 = $9 << 1 | 0;
        HEAP8[$10 >> 0] = HEAPU8[($11 + 1051225 | 0) >> 0] | 0;
        if (($4 + -3 | 0) >>> 0 < $2 >>> 0) {
         break block2
        }
        _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($4 + -3 | 0 | 0, $2 | 0, 1051428 | 0);
        wasm2js_trap();
       }
       _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($4 + -4 | 0 | 0, $2 | 0, 1051428 | 0);
       wasm2js_trap();
      }
      HEAP8[($10 + 1 | 0) >> 0] = HEAPU8[($11 + 1051226 | 0) >> 0] | 0;
      block3 : {
       if (($4 + -2 | 0) >>> 0 >= $2 >>> 0) {
        break block3
       }
       $9 = (($8 - Math_imul($9, 100) | 0) << 1 | 0) & 131070 | 0;
       HEAP8[($10 + 2 | 0) >> 0] = HEAPU8[($9 + 1051225 | 0) >> 0] | 0;
       if (($4 + -1 | 0) >>> 0 >= $2 >>> 0) {
        break block4
       }
       HEAP8[($10 + 3 | 0) >> 0] = HEAPU8[($9 + 1051226 | 0) >> 0] | 0;
       $5 = $5 + -4 | 0;
       $6 = $6 + -4 | 0;
       $4 = $7 >>> 0 > 9999999 >>> 0;
       $7 = $3;
       if (!$4) {
        break block5
       }
       continue label;
      }
      break label;
     };
     _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($4 + -2 | 0 | 0, $2 | 0, 1051428 | 0);
     wasm2js_trap();
    }
    _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($4 + -1 | 0 | 0, $2 | 0, 1051428 | 0);
    wasm2js_trap();
   }
   $4 = $2 + $6 | 0;
  }
  block7 : {
   block6 : {
    if ($3 >>> 0 > 9 >>> 0) {
     break block6
    }
    $10 = $3;
    $7 = $4;
    break block7;
   }
   $10 = (($3 & 65535 | 0) >>> 0) / (100 >>> 0) | 0;
   block9 : {
    block8 : {
     $7 = $4 + -2 | 0;
     if ($7 >>> 0 >= $2 >>> 0) {
      break block8
     }
     $6 = (($3 - Math_imul($10, 100) | 0) & 65535 | 0) << 1 | 0;
     HEAP8[($1 + $7 | 0) >> 0] = HEAPU8[($6 + 1051225 | 0) >> 0] | 0;
     $4 = $4 + -1 | 0;
     if ($4 >>> 0 >= $2 >>> 0) {
      break block9
     }
     HEAP8[($1 + $4 | 0) >> 0] = HEAPU8[($6 + 1051226 | 0) >> 0] | 0;
     break block7;
    }
    _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($7 | 0, $2 | 0, 1051428 | 0);
    wasm2js_trap();
   }
   _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($4 | 0, $2 | 0, 1051428 | 0);
   wasm2js_trap();
  }
  block11 : {
   block10 : {
    if (!$0) {
     break block10
    }
    if (!$10) {
     break block11
    }
   }
   block12 : {
    $7 = $7 + -1 | 0;
    if ($7 >>> 0 < $2 >>> 0) {
     break block12
    }
    _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($7 | 0, $2 | 0, 1051428 | 0);
    wasm2js_trap();
   }
   HEAP8[($1 + $7 | 0) >> 0] = HEAPU8[(($10 << 1 | 0) + 1051226 | 0) >> 0] | 0;
  }
  return $7 | 0;
 }
 
 function _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 32 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 16 | 0) >> 2] = $1;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP16[($3 + 28 | 0) >> 1] = 1;
  HEAP32[($3 + 24 | 0) >> 2] = $2;
  HEAP32[($3 + 20 | 0) >> 2] = $3 + 12 | 0;
  _RNvCs5QKde7ScR4H_7___rustc17rust_begin_unwind($3 + 20 | 0 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3str8converts9from_utf817h82c888a988db5c6bE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var i64toi32_i32$0 = 0, $3 = 0, $6 = 0, $10 = 0, $9$hi = 0, $8$hi = 0, $9 = 0, $8 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $7 = 0, $4 = 0, $5 = 0, $151$hi = 0, $152$hi = 0, $154 = 0;
  block : {
   if (!$2) {
    break block
   }
   $3 = $2 + -7 | 0;
   $4 = $3 >>> 0 > $2 >>> 0 ? 0 : $3;
   $5 = (($1 + 3 | 0) & -4 | 0) - $1 | 0;
   $3 = 0;
   label2 : while (1) {
    block25 : {
     block3 : {
      block2 : {
       block1 : {
        $6 = HEAPU8[($1 + $3 | 0) >> 0] | 0;
        $7 = $6 << 24 >> 24;
        if (($7 | 0) < (0 | 0)) {
         break block1
        }
        if (($5 - $3 | 0) & 3 | 0) {
         break block2
        }
        if ($3 >>> 0 >= $4 >>> 0) {
         break block3
        }
        label : while (1) {
         $6 = $1 + $3 | 0;
         if ((HEAP32[($6 + 4 | 0) >> 2] | 0 | (HEAP32[$6 >> 2] | 0) | 0) & -2139062144 | 0) {
          break block3
         }
         $3 = $3 + 8 | 0;
         if ($3 >>> 0 < $4 >>> 0) {
          continue label
         }
         break block3;
        };
       }
       i64toi32_i32$0 = 256;
       $8 = 0;
       $8$hi = i64toi32_i32$0;
       i64toi32_i32$0 = 1;
       $9 = 0;
       $9$hi = i64toi32_i32$0;
       block11 : {
        block7 : {
         block24 : {
          block23 : {
           block15 : {
            block16 : {
             block10 : {
              block9 : {
               block8 : {
                block6 : {
                 switch ((HEAPU8[($6 + 1051447 | 0) >> 0] | 0) + -2 | 0 | 0) {
                 case 0:
                  $6 = $3 + 1 | 0;
                  if ($6 >>> 0 < $2 >>> 0) {
                   break block8
                  }
                  i64toi32_i32$0 = 0;
                  $8 = 0;
                  $8$hi = i64toi32_i32$0;
                  i64toi32_i32$0 = 0;
                  $9 = 0;
                  $9$hi = i64toi32_i32$0;
                  break block7;
                 case 1:
                  i64toi32_i32$0 = 0;
                  $8 = 0;
                  $8$hi = i64toi32_i32$0;
                  $10 = $3 + 1 | 0;
                  if ($10 >>> 0 < $2 >>> 0) {
                   break block9
                  }
                  i64toi32_i32$0 = 0;
                  $9 = 0;
                  $9$hi = i64toi32_i32$0;
                  break block7;
                 case 2:
                  break block6;
                 default:
                  break block7;
                 };
                }
                i64toi32_i32$0 = 0;
                $8 = 0;
                $8$hi = i64toi32_i32$0;
                $10 = $3 + 1 | 0;
                if ($10 >>> 0 < $2 >>> 0) {
                 break block10
                }
                i64toi32_i32$0 = 0;
                $9 = 0;
                $9$hi = i64toi32_i32$0;
                break block7;
               }
               i64toi32_i32$0 = 256;
               $8 = 0;
               $8$hi = i64toi32_i32$0;
               i64toi32_i32$0 = 1;
               $9 = 0;
               $9$hi = i64toi32_i32$0;
               if ((HEAP8[($1 + $6 | 0) >> 0] | 0 | 0) > (-65 | 0)) {
                break block7
               }
               break block11;
              }
              $10 = HEAP8[($1 + $10 | 0) >> 0] | 0;
              block13 : {
               switch ($6 + -224 | 0 | 0) {
               case 0:
                if (($10 & -32 | 0 | 0) == (-96 | 0)) {
                 break block15
                }
                break block16;
               case 13:
                if (($10 | 0) > (-97 | 0)) {
                 break block16
                }
                break block15;
               default:
                break block13;
               };
              }
              block17 : {
               if ((($7 + 31 | 0) & 255 | 0) >>> 0 < 12 >>> 0) {
                break block17
               }
               if (($7 & -2 | 0 | 0) != (-18 | 0)) {
                break block16
               }
               if (($10 | 0) < (-64 | 0)) {
                break block15
               }
               break block16;
              }
              if (($10 | 0) < (-64 | 0)) {
               break block15
              }
              break block16;
             }
             $10 = HEAP8[($1 + $10 | 0) >> 0] | 0;
             block21 : {
              block20 : {
               switch ($6 + -240 | 0 | 0) {
               default:
                if ((($7 + 15 | 0) & 255 | 0) >>> 0 > 2 >>> 0) {
                 break block16
                }
                if (($10 | 0) >= (-64 | 0)) {
                 break block16
                }
                break block21;
               case 0:
                if ((($10 + 112 | 0) & 255 | 0) >>> 0 >= 48 >>> 0) {
                 break block16
                }
                break block21;
               case 4:
                break block20;
               };
              }
              if (($10 | 0) > (-113 | 0)) {
               break block16
              }
             }
             block22 : {
              $6 = $3 + 2 | 0;
              if ($6 >>> 0 < $2 >>> 0) {
               break block22
              }
              i64toi32_i32$0 = 0;
              $9 = 0;
              $9$hi = i64toi32_i32$0;
              break block7;
             }
             if ((HEAP8[($1 + $6 | 0) >> 0] | 0 | 0) > (-65 | 0)) {
              break block23
             }
             i64toi32_i32$0 = 0;
             $9 = 0;
             $9$hi = i64toi32_i32$0;
             $6 = $3 + 3 | 0;
             if ($6 >>> 0 >= $2 >>> 0) {
              break block7
             }
             if ((HEAP8[($1 + $6 | 0) >> 0] | 0 | 0) < (-64 | 0)) {
              break block11
             }
             i64toi32_i32$0 = 768;
             $8 = 0;
             $8$hi = i64toi32_i32$0;
             break block24;
            }
            i64toi32_i32$0 = 256;
            $8 = 0;
            $8$hi = i64toi32_i32$0;
            break block24;
           }
           i64toi32_i32$0 = 0;
           $9 = 0;
           $9$hi = i64toi32_i32$0;
           $6 = $3 + 2 | 0;
           if ($6 >>> 0 >= $2 >>> 0) {
            break block7
           }
           if ((HEAP8[($1 + $6 | 0) >> 0] | 0 | 0) <= (-65 | 0)) {
            break block11
           }
          }
          i64toi32_i32$0 = 512;
          $8 = 0;
          $8$hi = i64toi32_i32$0;
         }
         i64toi32_i32$0 = 1;
         $9 = 0;
         $9$hi = i64toi32_i32$0;
        }
        i64toi32_i32$0 = $8$hi;
        i64toi32_i32$0 = 0;
        $151$hi = i64toi32_i32$0;
        i64toi32_i32$0 = $8$hi;
        i64toi32_i32$2 = $8;
        i64toi32_i32$1 = $151$hi;
        i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
        $152$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $9$hi;
        i64toi32_i32$1 = $152$hi;
        i64toi32_i32$0 = i64toi32_i32$2 | $3 | 0;
        i64toi32_i32$2 = $9$hi;
        i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
        $154 = i64toi32_i32$0 | $9 | 0;
        i64toi32_i32$0 = $0;
        HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = $154;
        HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = i64toi32_i32$2;
        HEAP32[i64toi32_i32$0 >> 2] = 1;
        return;
       }
       $3 = $6 + 1 | 0;
       break block25;
      }
      $3 = $3 + 1 | 0;
      break block25;
     }
     if ($3 >>> 0 >= $2 >>> 0) {
      break block25
     }
     label1 : while (1) {
      if ((HEAP8[($1 + $3 | 0) >> 0] | 0 | 0) < (0 | 0)) {
       break block25
      }
      $3 = $3 + 1 | 0;
      if (($2 | 0) != ($3 | 0)) {
       continue label1
      }
      break block;
     };
    }
    if ($3 >>> 0 < $2 >>> 0) {
     continue label2
    }
    break label2;
   };
  }
  HEAP32[($0 + 8 | 0) >> 2] = $2;
  HEAP32[($0 + 4 | 0) >> 2] = $1;
  HEAP32[$0 >> 2] = 0;
 }
 
 function _ZN4core9panicking18panic_bounds_check17h7579eaf72437c68dE($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, $3 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, $16 = 0, $4 = 0, $12 = 0, $4$hi = 0, $18$hi = 0, $19 = 0, $24$hi = 0, $25 = 0;
  $3 = __stack_pointer - 32 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $1;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $12 = $3;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = 28;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $16 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $16 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $4 = $16;
  $4$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $18$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $4$hi;
  i64toi32_i32$0 = $4;
  i64toi32_i32$2 = $18$hi;
  i64toi32_i32$3 = $3 + 8 | 0;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  $19 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $12;
  HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $19;
  HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$2 = 0;
  $24$hi = i64toi32_i32$2;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$1 = $4;
  i64toi32_i32$0 = $24$hi;
  i64toi32_i32$3 = $3 + 12 | 0;
  i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
  $25 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
  i64toi32_i32$1 = $3;
  HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $25;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048619 | 0, i64toi32_i32$1 + 16 | 0 | 0, $2 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$4_fmt17hfd251423c4523d9bE($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $1 = _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$10_fmt_inner17h689fb7c6c0da79c3E($1 | 0, $2 | 0, $3 | 0) | 0;
  HEAP32[($0 + 4 | 0) >> 2] = $3 - $1 | 0;
  HEAP32[$0 >> 2] = $2 + $1 | 0;
 }
 
 function _ZN4core3fmt3num3imp52_$LT$impl$u20$core__fmt__Display$u20$for$u20$i32$GT$3fmt17h9c88fd8fc89d848dE($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0, $12 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  $0 = HEAP32[$0 >> 2] | 0;
  $12 = ($0 ^ -1 | 0) >>> 31 | 0;
  $3 = $0 >> 31 | 0;
  $0 = _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$10_fmt_inner17h689fb7c6c0da79c3E(($0 ^ $3 | 0) - $3 | 0 | 0, $2 + 6 | 0 | 0, 10 | 0) | 0;
  $0 = _ZN4core3fmt9Formatter12pad_integral17hc160c494f42f5c87E($1 | 0, $12 | 0, 1 | 0, 0 | 0, ($2 + 6 | 0) + $0 | 0 | 0, 10 - $0 | 0 | 0) | 0;
  __stack_pointer = $2 + 16 | 0;
  return $0 | 0;
 }
 
 function _ZN4core3fmt3num3imp52_$LT$impl$u20$core__fmt__Display$u20$for$u20$u32$GT$3fmt17h7aaa6d510d044ea7E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  $0 = _ZN4core3fmt3num3imp21_$LT$impl$u20$u32$GT$10_fmt_inner17h689fb7c6c0da79c3E(HEAP32[$0 >> 2] | 0 | 0, $2 + 6 | 0 | 0, 10 | 0) | 0;
  $0 = _ZN4core3fmt9Formatter12pad_integral17hc160c494f42f5c87E($1 | 0, 1 | 0, 1 | 0, 0 | 0, ($2 + 6 | 0) + $0 | 0 | 0, 10 - $0 | 0 | 0) | 0;
  __stack_pointer = $2 + 16 | 0;
  return $0 | 0;
 }
 
 function _ZN4core5slice5index16slice_index_fail17hd5820a8e667bb547E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, $4 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, $5 = 0, $5$hi = 0, $30 = 0, $31 = 0, $32 = 0, $28$hi = 0, $29 = 0, $34$hi = 0, $35 = 0, $43 = 0, $49$hi = 0, $50 = 0, $55$hi = 0, $56 = 0, $64 = 0, $70$hi = 0, $71 = 0, $76$hi = 0, $77 = 0, $89$hi = 0, $90 = 0, $95$hi = 0, $96 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  block2 : {
   block1 : {
    block : {
     if ($0 >>> 0 > $2 >>> 0) {
      break block
     }
     if ($1 >>> 0 > $2 >>> 0) {
      break block1
     }
     i64toi32_i32$0 = 0;
     i64toi32_i32$2 = 28;
     i64toi32_i32$1 = 0;
     i64toi32_i32$3 = 32;
     i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
      $30 = 0;
     } else {
      i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
      $30 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     }
     $5 = $30;
     $5$hi = i64toi32_i32$1;
     if ($0 >>> 0 <= $1 >>> 0) {
      break block2
     }
     HEAP32[($4 + 8 | 0) >> 2] = $0;
     HEAP32[($4 + 12 | 0) >> 2] = $1;
     i64toi32_i32$1 = 0;
     $28$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $5$hi;
     i64toi32_i32$0 = $5;
     i64toi32_i32$2 = $28$hi;
     i64toi32_i32$3 = $4 + 12 | 0;
     i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
     $29 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
     i64toi32_i32$0 = $4;
     HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $29;
     HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
     i64toi32_i32$2 = i64toi32_i32$1;
     i64toi32_i32$2 = 0;
     $34$hi = i64toi32_i32$2;
     i64toi32_i32$2 = i64toi32_i32$1;
     i64toi32_i32$1 = $5;
     i64toi32_i32$0 = $34$hi;
     i64toi32_i32$3 = $4 + 8 | 0;
     i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
     $35 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
     i64toi32_i32$1 = $4;
     HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $35;
     HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
     _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048579 | 0, i64toi32_i32$1 + 16 | 0 | 0, $3 | 0);
     wasm2js_trap();
    }
    HEAP32[($4 + 8 | 0) >> 2] = $0;
    HEAP32[($4 + 12 | 0) >> 2] = $2;
    $43 = $4;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 28;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 32;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $31 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $31 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $5 = $31;
    $5$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $49$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $5$hi;
    i64toi32_i32$0 = $5;
    i64toi32_i32$2 = $49$hi;
    i64toi32_i32$3 = $4 + 12 | 0;
    i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
    $50 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $43;
    HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $50;
    HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$2 = 0;
    $55$hi = i64toi32_i32$2;
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$1 = $5;
    i64toi32_i32$0 = $55$hi;
    i64toi32_i32$3 = $4 + 8 | 0;
    i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
    $56 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
    i64toi32_i32$1 = $4;
    HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $56;
    HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
    _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048674 | 0, i64toi32_i32$1 + 16 | 0 | 0, $3 | 0);
    wasm2js_trap();
   }
   HEAP32[($4 + 8 | 0) >> 2] = $1;
   HEAP32[($4 + 12 | 0) >> 2] = $2;
   $64 = $4;
   i64toi32_i32$0 = 0;
   i64toi32_i32$2 = 28;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $32 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $32 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $5 = $32;
   $5$hi = i64toi32_i32$1;
   i64toi32_i32$1 = 0;
   $70$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $5$hi;
   i64toi32_i32$0 = $5;
   i64toi32_i32$2 = $70$hi;
   i64toi32_i32$3 = $4 + 12 | 0;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $71 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   i64toi32_i32$0 = $64;
   HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $71;
   HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$2 = 0;
   $76$hi = i64toi32_i32$2;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$1 = $5;
   i64toi32_i32$0 = $76$hi;
   i64toi32_i32$3 = $4 + 8 | 0;
   i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
   $77 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
   i64toi32_i32$1 = $4;
   HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $77;
   HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
   _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048731 | 0, i64toi32_i32$1 + 16 | 0 | 0, $3 | 0);
   wasm2js_trap();
  }
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  HEAP32[($4 + 12 | 0) >> 2] = $2;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$0 = 0;
  $89$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $5$hi;
  i64toi32_i32$2 = $5;
  i64toi32_i32$1 = $89$hi;
  i64toi32_i32$3 = $4 + 12 | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  $90 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$2 = $4;
  HEAP32[(i64toi32_i32$2 + 24 | 0) >> 2] = $90;
  HEAP32[(i64toi32_i32$2 + 28 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$1 = 0;
  $95$hi = i64toi32_i32$1;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$0 = $5;
  i64toi32_i32$2 = $95$hi;
  i64toi32_i32$3 = $4 + 8 | 0;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  $96 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $4;
  HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] = $96;
  HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] = i64toi32_i32$2;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048731 | 0, i64toi32_i32$0 + 16 | 0 | 0, $3 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core9panicking5panic17h19814263112256c0E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE($0 | 0, $1 << 1 | 0 | 1 | 0 | 0, $2 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core3fmt8builders11DebugStruct6finish17ha06c88fdde62e2d2E($0) {
  $0 = $0 | 0;
  var $2 = 0, $1 = 0;
  $1 = HEAPU8[($0 + 4 | 0) >> 0] | 0;
  $2 = $1;
  block : {
   if (!(HEAPU8[($0 + 5 | 0) >> 0] | 0)) {
    break block
   }
   $2 = 1;
   block1 : {
    if ($1 & 1 | 0) {
     break block1
    }
    block2 : {
     $2 = HEAP32[$0 >> 2] | 0;
     if ((HEAPU8[($2 + 10 | 0) >> 0] | 0) & 128 | 0) {
      break block2
     }
     $2 = FUNCTION_TABLE[HEAP32[((HEAP32[($2 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$2 >> 2] | 0, 1051445, 2) | 0;
     break block1;
    }
    $2 = FUNCTION_TABLE[HEAP32[((HEAP32[($2 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$2 >> 2] | 0, 1051444, 1) | 0;
   }
   HEAP8[($0 + 4 | 0) >> 0] = $2;
  }
  return $2 & 1 | 0 | 0;
 }
 
 function _ZN4core3fmt9Formatter12debug_struct17h6d68658d5a493288E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $3 = FUNCTION_TABLE[HEAP32[((HEAP32[($1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$1 >> 2] | 0, $2, $3) | 0;
  HEAP8[($0 + 5 | 0) >> 0] = 0;
  HEAP8[($0 + 4 | 0) >> 0] = $3;
  HEAP32[$0 >> 2] = $1;
 }
 
 function _ZN4core3fmt9Formatter12pad_integral12write_prefix17hbac726506c465456E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  block : {
   if (($2 | 0) == (1114112 | 0)) {
    break block
   }
   if (!(FUNCTION_TABLE[HEAP32[($1 + 16 | 0) >> 2] | 0 | 0]($0, $2) | 0)) {
    break block
   }
   return 1 | 0;
  }
  block1 : {
   if ($3) {
    break block1
   }
   return 0 | 0;
  }
  return FUNCTION_TABLE[HEAP32[($1 + 12 | 0) >> 2] | 0 | 0]($0, $3, $4) | 0 | 0;
 }
 
 function _ZN4core3str5count14do_count_chars17h53eda46924511659E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $8 = 0, $7 = 0, $3 = 0, $6 = 0, $4 = 0, $5 = 0, $9 = 0, $131 = 0, $141 = 0, $151 = 0;
  block4 : {
   block : {
    $2 = ($0 + 3 | 0) & -4 | 0;
    $3 = $2 - $0 | 0;
    if ($1 >>> 0 < $3 >>> 0) {
     break block
    }
    $4 = $1 - $3 | 0;
    if ($4 >>> 0 < 4 >>> 0) {
     break block
    }
    $5 = $4 & 3 | 0;
    $6 = 0;
    $1 = 0;
    block1 : {
     if (($2 | 0) == ($0 | 0)) {
      break block1
     }
     $7 = 0;
     $1 = 0;
     block2 : {
      $8 = $0 - $2 | 0;
      if ($8 >>> 0 > -4 >>> 0) {
       break block2
      }
      $7 = 0;
      $1 = 0;
      label : while (1) {
       $2 = $0 + $7 | 0;
       $1 = ((($1 + ((HEAP8[$2 >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($2 + 1 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($2 + 2 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($2 + 3 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
       $7 = $7 + 4 | 0;
       if ($7) {
        continue label
       }
       break label;
      };
     }
     $2 = $0 + $7 | 0;
     label1 : while (1) {
      $1 = $1 + ((HEAP8[$2 >> 0] | 0 | 0) > (-65 | 0)) | 0;
      $2 = $2 + 1 | 0;
      $8 = $8 + 1 | 0;
      if ($8) {
       continue label1
      }
      break label1;
     };
    }
    $8 = $0 + $3 | 0;
    block3 : {
     if (!$5) {
      break block3
     }
     $2 = $8 + ($4 & 2147483644 | 0) | 0;
     $6 = (HEAP8[$2 >> 0] | 0 | 0) > (-65 | 0);
     if (($5 | 0) == (1 | 0)) {
      break block3
     }
     $6 = $6 + ((HEAP8[($2 + 1 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
     if (($5 | 0) == (2 | 0)) {
      break block3
     }
     $6 = $6 + ((HEAP8[($2 + 2 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
    }
    $3 = $4 >>> 2 | 0;
    $7 = $6 + $1 | 0;
    label3 : while (1) {
     $4 = $8;
     if (!$3) {
      break block4
     }
     $6 = $3 >>> 0 < 192 >>> 0 ? $3 : 192;
     $5 = $6 & 3 | 0;
     block6 : {
      block5 : {
       $9 = $6 << 2 | 0;
       $1 = $9 & 1008 | 0;
       if ($1) {
        break block5
       }
       $2 = 0;
       break block6;
      }
      $0 = $4 + $1 | 0;
      $2 = 0;
      $1 = $4;
      label2 : while (1) {
       $8 = HEAP32[($1 + 12 | 0) >> 2] | 0;
       $131 = (($8 ^ -1 | 0) >>> 7 | 0 | ($8 >>> 6 | 0) | 0) & 16843009 | 0;
       $8 = HEAP32[($1 + 8 | 0) >> 2] | 0;
       $141 = (($8 ^ -1 | 0) >>> 7 | 0 | ($8 >>> 6 | 0) | 0) & 16843009 | 0;
       $8 = HEAP32[($1 + 4 | 0) >> 2] | 0;
       $151 = (($8 ^ -1 | 0) >>> 7 | 0 | ($8 >>> 6 | 0) | 0) & 16843009 | 0;
       $8 = HEAP32[$1 >> 2] | 0;
       $2 = $131 + ($141 + ($151 + (((($8 ^ -1 | 0) >>> 7 | 0 | ($8 >>> 6 | 0) | 0) & 16843009 | 0) + $2 | 0) | 0) | 0) | 0;
       $1 = $1 + 16 | 0;
       if (($1 | 0) != ($0 | 0)) {
        continue label2
       }
       break label2;
      };
     }
     $3 = $3 - $6 | 0;
     $8 = $4 + $9 | 0;
     $7 = (Math_imul((($2 >>> 8 | 0) & 16711935 | 0) + ($2 & 16711935 | 0) | 0, 65537) >>> 16 | 0) + $7 | 0;
     if (!$5) {
      continue label3
     }
     break label3;
    };
    $2 = $4 + (($6 & 252 | 0) << 2 | 0) | 0;
    $1 = HEAP32[$2 >> 2] | 0;
    $1 = (($1 ^ -1 | 0) >>> 7 | 0 | ($1 >>> 6 | 0) | 0) & 16843009 | 0;
    block7 : {
     if (($5 | 0) == (1 | 0)) {
      break block7
     }
     $8 = HEAP32[($2 + 4 | 0) >> 2] | 0;
     $1 = ((($8 ^ -1 | 0) >>> 7 | 0 | ($8 >>> 6 | 0) | 0) & 16843009 | 0) + $1 | 0;
     if (($5 | 0) == (2 | 0)) {
      break block7
     }
     $2 = HEAP32[($2 + 8 | 0) >> 2] | 0;
     $1 = ((($2 ^ -1 | 0) >>> 7 | 0 | ($2 >>> 6 | 0) | 0) & 16843009 | 0) + $1 | 0;
    }
    $7 = (Math_imul((($1 >>> 8 | 0) & 459007 | 0) + ($1 & 16711935 | 0) | 0, 65537) >>> 16 | 0) + $7 | 0;
    break block4;
   }
   block8 : {
    if ($1) {
     break block8
    }
    return 0 | 0;
   }
   $8 = $1 & 3 | 0;
   block10 : {
    block9 : {
     if ($1 >>> 0 >= 4 >>> 0) {
      break block9
     }
     $2 = 0;
     $7 = 0;
     break block10;
    }
    $3 = $1 & -4 | 0;
    $2 = 0;
    $7 = 0;
    label4 : while (1) {
     $1 = $0 + $2 | 0;
     $7 = ((($7 + ((HEAP8[$1 >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($1 + 1 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($1 + 2 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0) + ((HEAP8[($1 + 3 | 0) >> 0] | 0 | 0) > (-65 | 0)) | 0;
     $2 = $2 + 4 | 0;
     if (($3 | 0) != ($2 | 0)) {
      continue label4
     }
     break label4;
    };
   }
   if (!$8) {
    break block4
   }
   $1 = $0 + $2 | 0;
   label5 : while (1) {
    $7 = $7 + ((HEAP8[$1 >> 0] | 0 | 0) > (-65 | 0)) | 0;
    $1 = $1 + 1 | 0;
    $8 = $8 + -1 | 0;
    if ($8) {
     continue label5
    }
    break label5;
   };
  }
  return $7 | 0;
 }
 
 function _ZN4core3fmt9Formatter9write_str17hebb2b1ebf80b0253E($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  return FUNCTION_TABLE[HEAP32[((HEAP32[($0 + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[$0 >> 2] | 0, $1, $2) | 0 | 0;
 }
 
 function _ZN4core6option13unwrap_failed17h8ebba99799176358E($0) {
  $0 = $0 | 0;
  _ZN4core9panicking5panic17h19814263112256c0E(1051736 | 0, 43 | 0, $0 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core5slice6memchr14memchr_aligned17h904fe62a3687c6a8E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $4 = 0, $6 = 0, $7 = 0, $8 = 0, $5 = 0;
  block3 : {
   block4 : {
    block1 : {
     block : {
      $4 = ($2 + 3 | 0) & -4 | 0;
      if (($4 | 0) != ($2 | 0)) {
       break block
      }
      $5 = $3 + -8 | 0;
      $4 = 0;
      break block1;
     }
     $4 = $4 - $2 | 0;
     $4 = $3 >>> 0 < $4 >>> 0 ? $3 : $4;
     block2 : {
      if (!$3) {
       break block2
      }
      $6 = 0;
      $7 = $1 & 255 | 0;
      $8 = 1;
      label : while (1) {
       if ((HEAPU8[($2 + $6 | 0) >> 0] | 0 | 0) == ($7 | 0)) {
        break block3
       }
       $6 = $6 + 1 | 0;
       if (($4 | 0) != ($6 | 0)) {
        continue label
       }
       break label;
      };
     }
     $5 = $3 + -8 | 0;
     if ($4 >>> 0 > $5 >>> 0) {
      break block4
     }
    }
    $6 = Math_imul($1 & 255 | 0, 16843009);
    label1 : while (1) {
     $7 = $2 + $4 | 0;
     $8 = (HEAP32[$7 >> 2] | 0) ^ $6 | 0;
     $7 = (HEAP32[($7 + 4 | 0) >> 2] | 0) ^ $6 | 0;
     if ((((16843008 - $8 | 0 | $8 | 0) & (16843008 - $7 | 0 | $7 | 0) | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
      break block4
     }
     $4 = $4 + 8 | 0;
     if ($4 >>> 0 <= $5 >>> 0) {
      continue label1
     }
     break label1;
    };
   }
   block5 : {
    if (($3 | 0) == ($4 | 0)) {
     break block5
    }
    $6 = $1 & 255 | 0;
    $8 = 1;
    label2 : while (1) {
     block6 : {
      if ((HEAPU8[($2 + $4 | 0) >> 0] | 0 | 0) != ($6 | 0)) {
       break block6
      }
      $6 = $4;
      break block3;
     }
     $4 = $4 + 1 | 0;
     if (($3 | 0) != ($4 | 0)) {
      continue label2
     }
     break label2;
    };
   }
   $8 = 0;
  }
  HEAP32[($0 + 4 | 0) >> 2] = $6;
  HEAP32[$0 >> 2] = $8;
 }
 
 function _ZN4core5slice6memchr7memrchr17ha19b96b88482c7b1E($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $7 = 0, $8 = 0, $4 = 0, $9 = 0, $5 = 0, $10 = 0;
  $4 = $3;
  $5 = $3;
  block5 : {
   block7 : {
    block3 : {
     block2 : {
      block1 : {
       block : {
        $6 = (($2 + 3 | 0) & -4 | 0) - $2 | 0;
        if ($3 >>> 0 < $6 >>> 0) {
         break block
        }
        $7 = ($3 - $6 | 0) & 7 | 0;
        $4 = $3 - $7 | 0;
        if ($3 >>> 0 < $7 >>> 0) {
         break block1
        }
        $5 = $6;
       }
       $8 = 0 - $4 | 0;
       $9 = $2 + -1 | 0;
       $10 = $1 & 255 | 0;
       $6 = $3;
       label : while (1) {
        if (!($8 + $6 | 0)) {
         break block2
        }
        $7 = $9 + $6 | 0;
        $6 = $6 + -1 | 0;
        if ((HEAPU8[$7 >> 0] | 0 | 0) != ($10 | 0)) {
         continue label
        }
        break block3;
       };
      }
      _ZN4core5slice5index16slice_index_fail17hd5820a8e667bb547E($4 | 0, $3 | 0, $3 | 0, 1051720 | 0);
      wasm2js_trap();
     }
     $7 = Math_imul($1 & 255 | 0, 16843009);
     block4 : {
      label1 : while (1) {
       $6 = $4;
       if ($6 >>> 0 <= $5 >>> 0) {
        break block4
       }
       $4 = $6 + -8 | 0;
       $8 = $2 + $6 | 0;
       $9 = (HEAP32[($8 + -8 | 0) >> 2] | 0) ^ $7 | 0;
       $8 = (HEAP32[($8 + -4 | 0) >> 2] | 0) ^ $7 | 0;
       if ((((16843008 - $9 | 0 | $9 | 0) & (16843008 - $8 | 0 | $8 | 0) | 0) & -2139062144 | 0 | 0) == (-2139062144 | 0)) {
        continue label1
       }
       break label1;
      };
     }
     if ($6 >>> 0 > $3 >>> 0) {
      break block5
     }
     $4 = $2 + -1 | 0;
     $8 = $1 & 255 | 0;
     label2 : while (1) {
      block6 : {
       if ($6) {
        break block6
       }
       $7 = 0;
       break block7;
      }
      $7 = $4 + $6 | 0;
      $6 = $6 + -1 | 0;
      if ((HEAPU8[$7 >> 0] | 0 | 0) != ($8 | 0)) {
       continue label2
      }
      break label2;
     };
    }
    $7 = 1;
   }
   HEAP32[($0 + 4 | 0) >> 2] = $6;
   HEAP32[$0 >> 2] = $7;
   return;
  }
  _ZN4core5slice5index16slice_index_fail17hd5820a8e667bb547E(0 | 0, $6 | 0, $3 | 0, 1051704 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core6result13unwrap_failed17h0f3535ea1a218143E($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $5 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $19 = 0, $20 = 0, $17 = 0, $19$hi = 0, $22$hi = 0, $23 = 0, $24 = 0, $26$hi = 0, $28$hi = 0, $29 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 4 | 0) >> 2] = $1;
  HEAP32[$5 >> 2] = $0;
  HEAP32[($5 + 12 | 0) >> 2] = $3;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  $17 = $5;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = 29;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $19 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $19 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $19$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $22$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $19$hi;
  i64toi32_i32$0 = $19;
  i64toi32_i32$2 = $22$hi;
  i64toi32_i32$3 = $5 + 8 | 0;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  $23 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $17;
  HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = $23;
  HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] = i64toi32_i32$2;
  $24 = $5;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = 30;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $20 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $20 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $26$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $28$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $26$hi;
  i64toi32_i32$2 = $20;
  i64toi32_i32$1 = $28$hi;
  i64toi32_i32$3 = $5;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  $29 = i64toi32_i32$2 | $5 | 0;
  i64toi32_i32$2 = $24;
  HEAP32[(i64toi32_i32$2 + 16 | 0) >> 2] = $29;
  HEAP32[(i64toi32_i32$2 + 20 | 0) >> 2] = i64toi32_i32$1;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048975 | 0, $5 + 16 | 0 | 0, $4 | 0);
  wasm2js_trap();
 }
 
 function _ZN4core9panicking19assert_failed_inner17hfb039360ece1159dE($0, $1, $2, $3, $4, $5, $6, $7) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  $6 = $6 | 0;
  $7 = $7 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $8 = 0, $9 = 0, $9$hi = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $36 = 0, $42$hi = 0, $43 = 0, $47$hi = 0, $48 = 0, $49 = 0, $51$hi = 0, $54$hi = 0, $55 = 0, $56 = 0, $58$hi = 0, $61$hi = 0, $62 = 0, $66 = 0, $72$hi = 0, $73 = 0, $77$hi = 0, $78 = 0, $79 = 0, $81$hi = 0, $84$hi = 0, $85 = 0;
  $8 = __stack_pointer - 64 | 0;
  __stack_pointer = $8;
  HEAP32[($8 + 4 | 0) >> 2] = $2;
  HEAP32[$8 >> 2] = $1;
  HEAP32[($8 + 12 | 0) >> 2] = $4;
  HEAP32[($8 + 8 | 0) >> 2] = $3;
  $2 = ($0 & 255 | 0) << 2 | 0;
  HEAP32[($8 + 20 | 0) >> 2] = HEAP32[($2 + 1051804 | 0) >> 2] | 0;
  HEAP32[($8 + 16 | 0) >> 2] = HEAP32[($2 + 1051792 | 0) >> 2] | 0;
  block : {
   if (!$5) {
    break block
   }
   HEAP32[($8 + 28 | 0) >> 2] = $6;
   HEAP32[($8 + 24 | 0) >> 2] = $5;
   $36 = $8;
   i64toi32_i32$0 = 0;
   i64toi32_i32$2 = 29;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $38 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $38 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $9 = $38;
   $9$hi = i64toi32_i32$1;
   i64toi32_i32$1 = 0;
   $42$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $9$hi;
   i64toi32_i32$0 = $9;
   i64toi32_i32$2 = $42$hi;
   i64toi32_i32$3 = $8 + 8 | 0;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $43 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   i64toi32_i32$0 = $36;
   HEAP32[(i64toi32_i32$0 + 56 | 0) >> 2] = $43;
   HEAP32[(i64toi32_i32$0 + 60 | 0) >> 2] = i64toi32_i32$2;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$2 = 0;
   $47$hi = i64toi32_i32$2;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$1 = $9;
   i64toi32_i32$0 = $47$hi;
   i64toi32_i32$3 = $8;
   i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
   $48 = i64toi32_i32$1 | $8 | 0;
   i64toi32_i32$1 = $8;
   HEAP32[(i64toi32_i32$1 + 48 | 0) >> 2] = $48;
   HEAP32[(i64toi32_i32$1 + 52 | 0) >> 2] = i64toi32_i32$0;
   $49 = i64toi32_i32$1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$2 = 31;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $39 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $39 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $51$hi = i64toi32_i32$1;
   i64toi32_i32$1 = 0;
   $54$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $51$hi;
   i64toi32_i32$0 = $39;
   i64toi32_i32$2 = $54$hi;
   i64toi32_i32$3 = $8 + 24 | 0;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $55 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   i64toi32_i32$0 = $49;
   HEAP32[(i64toi32_i32$0 + 40 | 0) >> 2] = $55;
   HEAP32[(i64toi32_i32$0 + 44 | 0) >> 2] = i64toi32_i32$2;
   $56 = $8;
   i64toi32_i32$2 = 0;
   i64toi32_i32$1 = 30;
   i64toi32_i32$0 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $40 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
    $40 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $58$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   $61$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $58$hi;
   i64toi32_i32$2 = $40;
   i64toi32_i32$1 = $61$hi;
   i64toi32_i32$3 = $8 + 16 | 0;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $62 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   i64toi32_i32$2 = $56;
   HEAP32[(i64toi32_i32$2 + 32 | 0) >> 2] = $62;
   HEAP32[(i64toi32_i32$2 + 36 | 0) >> 2] = i64toi32_i32$1;
   _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048841 | 0, $8 + 32 | 0 | 0, $7 | 0);
   wasm2js_trap();
  }
  $66 = $8;
  i64toi32_i32$1 = 0;
  i64toi32_i32$0 = 29;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   $41 = 0;
  } else {
   i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $41 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
  }
  $9 = $41;
  $9$hi = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  $72$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $9$hi;
  i64toi32_i32$1 = $9;
  i64toi32_i32$0 = $72$hi;
  i64toi32_i32$3 = $8 + 8 | 0;
  i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
  $73 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
  i64toi32_i32$1 = $66;
  HEAP32[(i64toi32_i32$1 + 48 | 0) >> 2] = $73;
  HEAP32[(i64toi32_i32$1 + 52 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$0 = 0;
  $77$hi = i64toi32_i32$0;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$2 = $9;
  i64toi32_i32$1 = $77$hi;
  i64toi32_i32$3 = $8;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  $78 = i64toi32_i32$2 | $8 | 0;
  i64toi32_i32$2 = $8;
  HEAP32[(i64toi32_i32$2 + 40 | 0) >> 2] = $78;
  HEAP32[(i64toi32_i32$2 + 44 | 0) >> 2] = i64toi32_i32$1;
  $79 = i64toi32_i32$2;
  i64toi32_i32$1 = 0;
  i64toi32_i32$0 = 30;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   $42 = 0;
  } else {
   i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $42 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
  }
  $81$hi = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  $84$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $81$hi;
  i64toi32_i32$1 = $42;
  i64toi32_i32$0 = $84$hi;
  i64toi32_i32$3 = $8 + 16 | 0;
  i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
  $85 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
  i64toi32_i32$1 = $79;
  HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] = $85;
  HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] = i64toi32_i32$0;
  _ZN4core9panicking9panic_fmt17hb8badb9a939ccf7aE(1048786 | 0, $8 + 32 | 0 | 0, $7 | 0);
  wasm2js_trap();
 }
 
 function _ZN59_$LT$core__fmt__Arguments$u20$as$u20$core__fmt__Display$GT$3fmt17he043c2a2fa295599E($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return _ZN4core3fmt5write17h8a3933e32b2d6a91E(HEAP32[$1 >> 2] | 0 | 0, HEAP32[($1 + 4 | 0) >> 2] | 0 | 0, HEAP32[$0 >> 2] | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0;
 }
 
 function memcmp($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0, $5 = 0;
  $3 = 0;
  block : {
   if (!$2) {
    break block
   }
   block1 : {
    label : while (1) {
     $4 = HEAPU8[$0 >> 0] | 0;
     $5 = HEAPU8[$1 >> 0] | 0;
     if (($4 | 0) != ($5 | 0)) {
      break block1
     }
     $0 = $0 + 1 | 0;
     $1 = $1 + 1 | 0;
     $2 = $2 + -1 | 0;
     if (!$2) {
      break block
     }
     continue label;
    };
   }
   $3 = $4 - $5 | 0;
  }
  return $3 | 0;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21 = 0, $22 = 0, var$6 = 0, $24 = 0, $17 = 0, $18 = 0, $23 = 0, $29 = 0, $45 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17 = Math_imul(var$4, var$5);
  $18 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23 = $17 + Math_imul($18, $21) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29 = $23 + Math_imul($22, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45 = $29 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function __wasm_ctz_i32(var$0) {
  var$0 = var$0 | 0;
  if (var$0) {
   return 31 - Math_clz32((var$0 + -1 | 0) ^ var$0 | 0) | 0 | 0
  }
  return 32 | 0;
 }
 
 function __wasm_ctz_i64(var$0, var$0$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, $10 = 0, $5$hi = 0, $8$hi = 0;
  i64toi32_i32$0 = var$0$hi;
  if (!!(var$0 | i64toi32_i32$0 | 0)) {
   i64toi32_i32$2 = var$0;
   i64toi32_i32$1 = -1;
   i64toi32_i32$3 = -1;
   i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
   i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
   if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
    i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
   }
   $5$hi = i64toi32_i32$5;
   i64toi32_i32$5 = var$0$hi;
   i64toi32_i32$5 = $5$hi;
   i64toi32_i32$0 = i64toi32_i32$4;
   i64toi32_i32$2 = var$0$hi;
   i64toi32_i32$3 = var$0;
   i64toi32_i32$2 = i64toi32_i32$5 ^ i64toi32_i32$2 | 0;
   i64toi32_i32$0 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
   i64toi32_i32$3 = Math_clz32(i64toi32_i32$2);
   i64toi32_i32$5 = 0;
   if ((i64toi32_i32$3 | 0) == (32 | 0)) {
    $10 = Math_clz32(i64toi32_i32$0) + 32 | 0
   } else {
    $10 = i64toi32_i32$3
   }
   $8$hi = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$0 = 63;
   i64toi32_i32$2 = $8$hi;
   i64toi32_i32$3 = $10;
   i64toi32_i32$1 = i64toi32_i32$0 - i64toi32_i32$3 | 0;
   i64toi32_i32$4 = (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$2 | 0;
   i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
   i64toi32_i32$0 = i64toi32_i32$1;
   i64toi32_i32$HIGH_BITS = i64toi32_i32$4;
   return i64toi32_i32$0 | 0;
  }
  i64toi32_i32$0 = 0;
  i64toi32_i32$4 = 64;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$4 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 function __wasm_rotl_i64(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, var$2$hi = 0, var$2 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $6$hi = 0, $8$hi = 0, $10 = 0, $10$hi = 0, $15$hi = 0, $17$hi = 0, $19$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$2 = var$1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 63;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  var$2 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  var$2$hi = i64toi32_i32$1;
  i64toi32_i32$1 = -1;
  i64toi32_i32$0 = -1;
  i64toi32_i32$2 = var$2$hi;
  i64toi32_i32$3 = var$2;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $19 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $19 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $6$hi = i64toi32_i32$2;
  i64toi32_i32$2 = var$0$hi;
  i64toi32_i32$2 = $6$hi;
  i64toi32_i32$1 = $19;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$3 = var$0;
  i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
  $8$hi = i64toi32_i32$0;
  i64toi32_i32$0 = var$2$hi;
  i64toi32_i32$0 = $8$hi;
  i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
  i64toi32_i32$1 = var$2$hi;
  i64toi32_i32$3 = var$2;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $20 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $20 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $10 = $20;
  $10$hi = i64toi32_i32$1;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = var$1$hi;
  i64toi32_i32$3 = var$1;
  i64toi32_i32$4 = i64toi32_i32$0 - i64toi32_i32$3 | 0;
  i64toi32_i32$5 = (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$2 | 0;
  i64toi32_i32$5 = i64toi32_i32$1 - i64toi32_i32$5 | 0;
  i64toi32_i32$1 = i64toi32_i32$4;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 63;
  i64toi32_i32$0 = i64toi32_i32$5 & i64toi32_i32$0 | 0;
  var$1 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
  var$1$hi = i64toi32_i32$0;
  i64toi32_i32$0 = -1;
  i64toi32_i32$5 = -1;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$3 = var$1;
  i64toi32_i32$2 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$5 << i64toi32_i32$2 | 0;
   $21 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$2 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$2 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$2 | 0) | 0;
   $21 = i64toi32_i32$5 << i64toi32_i32$2 | 0;
  }
  $15$hi = i64toi32_i32$1;
  i64toi32_i32$1 = var$0$hi;
  i64toi32_i32$1 = $15$hi;
  i64toi32_i32$0 = $21;
  i64toi32_i32$5 = var$0$hi;
  i64toi32_i32$3 = var$0;
  i64toi32_i32$5 = i64toi32_i32$1 & i64toi32_i32$5 | 0;
  $17$hi = i64toi32_i32$5;
  i64toi32_i32$5 = var$1$hi;
  i64toi32_i32$5 = $17$hi;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$3 = var$1;
  i64toi32_i32$2 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = 0;
   $22 = i64toi32_i32$5 >>> i64toi32_i32$2 | 0;
  } else {
   i64toi32_i32$0 = i64toi32_i32$5 >>> i64toi32_i32$2 | 0;
   $22 = (((1 << i64toi32_i32$2 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$2 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$2 | 0) | 0;
  }
  $19$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $10$hi;
  i64toi32_i32$5 = $10;
  i64toi32_i32$1 = $19$hi;
  i64toi32_i32$3 = $22;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$5 = i64toi32_i32$5 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$5 | 0;
 }
 
 bufferView = HEAPU8;
 initActiveSegments(imports);
 var FUNCTION_TABLE = [null, _ZN60_$LT$alloc__string__String$u20$as$u20$core__fmt__Display$GT$3fmt17h6a590826603d8397E, _ZN43_$LT$char$u20$as$u20$core__fmt__Display$GT$3fmt17h96ef625e78ca39a1E, _ZN4core3fmt3num3imp52_$LT$impl$u20$core__fmt__Display$u20$for$u20$i32$GT$3fmt17h9c88fd8fc89d848dE, _ZN4core3ops8function6FnOnce9call_once17ha557fb8d14849720E, _ZN3std5alloc24default_alloc_error_hook17h6e0a53e9d2f3abaeE, _ZN68_$LT$std__thread__local__AccessError$u20$as$u20$core__fmt__Debug$GT$3fmt17h9dcdc4c72eeff273E, _ZN4core3ptr42drop_in_place$LT$alloc__string__String$GT$17hd8bb0d969dc84d34E, _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$9write_str17h016b3e6048253d3cE, _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$10write_char17hc950aab5deb5eb09E, _ZN4core3fmt5Write9write_fmt17hc11eb16c9bd02408E, _ZN86_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__fmt__Display$GT$3fmt17hc09e543b77e45d95E, _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$8take_box17h191f69f185fcbba8E, _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$3get17h9dfb5af2d9d69a8dE, _ZN93_$LT$std__panicking__panic_handler__StaticStrPayload$u20$as$u20$core__panic__PanicPayload$GT$6as_str17h0ec005313dced4d5E, _ZN4core3ptr71drop_in_place$LT$std__panicking__panic_handler__FormatStringPayload$GT$17h277ad6c190aac400E, _ZN89_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__fmt__Display$GT$3fmt17heb4624cd16326d0aE, _ZN96_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__panic__PanicPayload$GT$8take_box17h8e2d5423ef79faceE, _ZN96_$LT$std__panicking__panic_handler__FormatStringPayload$u20$as$u20$core__panic__PanicPayload$GT$3get17h38e2909e2ad1bc1aE, _ZN4core5panic12PanicPayload6as_str17h48fb9d5ce40d3222E, _ZN42_$LT$$RF$T$u20$as$u20$core__fmt__Debug$GT$3fmt17h486f55f0065d2f82E, _ZN36_$LT$T$u20$as$u20$core__any__Any$GT$7type_id17h6197f0ebcddc27d1E, _ZN36_$LT$T$u20$as$u20$core__any__Any$GT$7type_id17hb068e4e2067c10daE, _ZN4core3ptr42drop_in_place$LT$alloc__string__String$GT$17hf93247b5f5ddbcfaE, _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$9write_str17h016b3e6048253d3cE_89, _ZN58_$LT$alloc__string__String$u20$as$u20$core__fmt__Write$GT$10write_char17hc950aab5deb5eb09E_87, _ZN4core3fmt5Write9write_fmt17h50ea9de0bbf4769cE, _ZN53_$LT$core__fmt__Error$u20$as$u20$core__fmt__Debug$GT$3fmt17h25009d44b1b6377aE, _ZN4core3fmt3num3imp52_$LT$impl$u20$core__fmt__Display$u20$for$u20$u32$GT$3fmt17h7aaa6d510d044ea7E, _ZN42_$LT$$RF$T$u20$as$u20$core__fmt__Debug$GT$3fmt17hbb6739267e179261E, _ZN44_$LT$$RF$T$u20$as$u20$core__fmt__Display$GT$3fmt17h6011d1b40ffa7fc2E, _ZN59_$LT$core__fmt__Arguments$u20$as$u20$core__fmt__Display$GT$3fmt17he043c2a2fa295599E];
 function __wasm_memory_size() {
  return buffer.byteLength >> 16;
 }
 
 function __wasm_memory_grow(pagesToAdd) {
  pagesToAdd = pagesToAdd | 0;
  var oldPages = __wasm_memory_size() | 0;
  var newPages = oldPages + pagesToAdd | 0;
  if ((oldPages < newPages) && (newPages < 65536)) {
   var newBuffer = new ArrayBuffer(newPages << 16);
   var newHEAP8 = new Int8Array(newBuffer);
   newHEAP8.set(HEAP8);
   HEAP8 = new Int8Array(newBuffer);
   HEAP16 = new Int16Array(newBuffer);
   HEAP32 = new Int32Array(newBuffer);
   HEAPU8 = new Uint8Array(newBuffer);
   HEAPU16 = new Uint16Array(newBuffer);
   HEAPU32 = new Uint32Array(newBuffer);
   HEAPF32 = new Float32Array(newBuffer);
   HEAPF64 = new Float64Array(newBuffer);
   buffer = newBuffer;
   bufferView = HEAPU8;
  }
  return oldPages;
 }
 
 return {
  "memory": Object.create(Object.prototype, {
   "grow": {
    "value": __wasm_memory_grow
   }, 
   "buffer": {
    "get": function () {
     return buffer;
    }
    
   }
  }), 
  "formula_ref_alloc": formula_ref_alloc, 
  "formula_ref_dealloc": formula_ref_dealloc, 
  "formula_ref_result_len": formula_ref_result_len, 
  "formula_ref_result_ptr": formula_ref_result_ptr, 
  "formula_ref_rewrite": formula_ref_rewrite, 
  "__data_end": {
   get value() {
    return global$1;
   }, 
   set value(_global$1) {
    global$1 = _global$1;
   }
  }, 
  "__heap_base": {
   get value() {
    return global$2;
   }, 
   set value(_global$2) {
    global$2 = _global$2;
   }
  }
 };
}

var retasmFunc = asmFunc({
});
export var memory = retasmFunc.memory;
export var formula_ref_alloc = retasmFunc.formula_ref_alloc;
export var formula_ref_dealloc = retasmFunc.formula_ref_dealloc;
export var formula_ref_result_len = retasmFunc.formula_ref_result_len;
export var formula_ref_result_ptr = retasmFunc.formula_ref_result_ptr;
export var formula_ref_rewrite = retasmFunc.formula_ref_rewrite;
export var __data_end = retasmFunc.__data_end;
export var __heap_base = retasmFunc.__heap_base;
