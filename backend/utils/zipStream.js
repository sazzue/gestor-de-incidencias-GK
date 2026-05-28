const { Readable } = require("stream");

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const updateCrc = (crc, chunk) => {
  let next = crc;
  for (const byte of chunk) {
    next = crcTable[(next ^ byte) & 0xff] ^ (next >>> 8);
  }
  return next >>> 0;
};

const dosDateTime = () => ({ time: 0, date: 0 });

const writeUInt32 = (buffer, value, offset) => {
  buffer.writeUInt32LE(value >>> 0, offset);
};

const createLocalHeader = (nameBuffer) => {
  const { time, date } = dosDateTime();
  const header = Buffer.alloc(30);
  writeUInt32(header, 0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x08, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt16LE(nameBuffer.length, 26);
  return Buffer.concat([header, nameBuffer]);
};

const createDataDescriptor = ({ crc, size }) => {
  const descriptor = Buffer.alloc(16);
  writeUInt32(descriptor, 0x08074b50, 0);
  writeUInt32(descriptor, crc, 4);
  writeUInt32(descriptor, size, 8);
  writeUInt32(descriptor, size, 12);
  return descriptor;
};

const createCentralDirectory = (entry) => {
  const { time, date } = dosDateTime();
  const header = Buffer.alloc(46);
  writeUInt32(header, 0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x08, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(date, 14);
  writeUInt32(header, entry.crc, 16);
  writeUInt32(header, entry.size, 20);
  writeUInt32(header, entry.size, 24);
  header.writeUInt16LE(entry.nameBuffer.length, 28);
  writeUInt32(header, entry.offset, 42);
  return Buffer.concat([header, entry.nameBuffer]);
};

const createEndOfCentralDirectory = ({ entryCount, centralSize, centralOffset }) => {
  const end = Buffer.alloc(22);
  writeUInt32(end, 0x06054b50, 0);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  writeUInt32(end, centralSize, 12);
  writeUInt32(end, centralOffset, 16);
  return end;
};

const streamZip = async ({ res, entries }) => {
  const centralEntries = [];
  let offset = 0;

  const write = (chunk) =>
    new Promise((resolve, reject) => {
      res.write(chunk, (error) => {
        if (error) return reject(error);
        offset += chunk.length;
        resolve();
      });
    });

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const entryOffset = offset;
    const localHeader = createLocalHeader(nameBuffer);
    await write(localHeader);

    let crc = 0xffffffff;
    let size = 0;
    const stream = entry.streamFactory
      ? await entry.streamFactory()
      : entry.stream || Readable.from(entry.buffer || Buffer.alloc(0));

    for await (const rawChunk of stream) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      crc = updateCrc(crc, chunk);
      size += chunk.length;
      await write(chunk);
    }

    crc = (crc ^ 0xffffffff) >>> 0;
    await write(createDataDescriptor({ crc, size }));
    centralEntries.push({ nameBuffer, offset: entryOffset, crc, size });
  }

  const centralOffset = offset;
  let centralSize = 0;

  for (const entry of centralEntries) {
    const central = createCentralDirectory(entry);
    centralSize += central.length;
    await write(central);
  }

  await write(createEndOfCentralDirectory({
    entryCount: centralEntries.length,
    centralSize,
    centralOffset,
  }));
};

module.exports = { streamZip };
