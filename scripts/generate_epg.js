const axios = require('axios');
const dayjs = require('dayjs');
const xmlbuilder = require('xmlbuilder');

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

async function fetchChannels() {
  const url = 'https://contentapi-br.cdn.telefonica.com/25/default/pt-BR/contents/all?ca_deviceTypes=401&contentTypes=LCH&ca_active=true';
  const response = await axios.get(url);
  return response.data.Content.List;
}

async function fetchEPG(pid, start, end) {
  const url = `https://contentapi-br.cdn.telefonica.com/25/default/pt-BR/schedules?ca_deviceTypes=null|401&ca_channelmaps=779|null&starttime=${start}&endtime=${end}&livechannelpids=${pid}&limit=1000`;

  try {
    const response = await axios.get(url);
    const programas = response.data.Content || [];
    console.log(`Canal ${pid}: ${programas.length} programas encontrados.`);
    return programas;
  } catch (err) {
    console.error(`Erro ao buscar EPG do canal ${pid}: ${err.message}`);
    return [];
  }
}

(async () => {
  const now = dayjs().tz('America/Sao_Paulo');
  const startTime = now.subtract(1, 'day').startOf('day').unix();  // Ontem 00:00
  const endTime = now.add(2, 'day').endOf('day').unix();           // Depois de amanhã 23:59

  console.log(`Gerando EPG VivoPlay de ${dayjs.unix(startTime).format()} até ${dayjs.unix(endTime).format()}`);

  const channels = await fetchChannels();

  const tv = xmlbuilder.create('tv', { encoding: 'UTF-8' });
  tv.att('generator-info-name', 'VivoPlay EPG Generator');
  tv.att('generator-info-url', 'https://github.com/seurepositorio');

  for (const channel of channels) {
    const pid = channel.Pid;
    const channelName = channel.Name;
    const iconUrl = channel.Images?.Icon?.[0]?.Url || '';

    // Criar a tag <channel>
    tv.ele('channel', { id: pid })
      .ele('display-name', {}, channelName).up()
      .ele('icon', { src: iconUrl }).up();

    // Buscar grade de programação do canal
    const programs = await fetchEPG(pid, startTime, endTime);

    programs.forEach(program => {
      const start = dayjs.unix(program.Start).utc().format('YYYYMMDDHHmmss +0000');
      const stop = dayjs.unix(program.End).utc().format('YYYYMMDDHHmmss +0000');
      const title = program.Title || 'Sem título';
      const desc = program.Description || '';

      const prog = tv.ele('programme', { start, stop, channel: pid });
      prog.ele('title', {}, title);
      prog.ele('desc', {}, desc);
    });
  }

  const xml = tv.end({ pretty: true });
  const fs = require('fs');
  fs.writeFileSync('guide.xml', xml, 'utf8');

  console.log('EPG gerado com sucesso em guide.xml');
})();
