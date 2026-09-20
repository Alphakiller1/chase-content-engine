import crypto from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const acceptKey = (key) => crypto.createHash("sha1").update(String(key) + GUID).digest("base64");

const encode = (text) => {
  const data = Buffer.from(String(text));
  const n = data.length;
  let header;
  if (n < 126) {
    header = Buffer.from([0x81, n]);
  } else if (n < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(n, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(n, 6);
  }
  return Buffer.concat([header, data]);
};

const encodePong = (payload) => {
  const n = payload.length;
  if (n >= 126) return Buffer.concat([Buffer.from([0x8a, 126, n >> 8, n & 255]), payload]);
  return Buffer.concat([Buffer.from([0x8a, n]), payload]);
};

/** Text JSON WebSocket. `onMsg` gets parsed objects. */
export const attachWs = (req, socket, head, onMsg) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return { send() {}, close() {} };
  }
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);
  if (head?.length) socket.unshift(head);
  let buf = Buffer.alloc(0);
  const send = (obj) => {
    try {
      socket.write(encode(JSON.stringify(obj)));
    } catch {
      /* closed */
    }
  };
  const close = () => {
    try {
      socket.end();
    } catch {
      /* already */
    }
  };
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const finOp = buf[0];
      const opcode = finOp & 15;
      const masked = buf[1] & 128;
      let len = buf[1] & 127;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      let payload = buf.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mask = buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(off + maskLen + len);
      if (opcode === 8) {
        close();
        return;
      }
      if (opcode === 9) {
        try {
          socket.write(encodePong(payload));
        } catch {
          /* closed */
        }
        continue;
      }
      if (opcode !== 1) continue;
      try {
        onMsg(JSON.parse(payload.toString("utf8")), send);
      } catch {
        /* ignore junk */
      }
    }
  });
  socket.on("error", () => {});
  return { send, close, socket };
};
