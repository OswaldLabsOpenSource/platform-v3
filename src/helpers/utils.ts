import anonymize from "ip-anonymize";
import { User } from "../interfaces/tables/user";
import dns from "dns";
import Joi from "@hapi/joi";
import LanguageDetect from "languagedetect";
import ISO6391 from "iso-639-1";
import { getOrganizationIdFromUsername } from "../crud/organization";
import { Request, Response } from "express";
import slugify from "slugify";
import cryptoRandomString from "crypto-random-string";
import { Tokens } from "../interfaces/enum";
import { ApiKeyResponse } from "./jwt";
import { isMatch } from "matcher";
import Hashids from "hashids/cjs";
import { getUserIdFromUsername } from "../crud/user";
import { HASH_IDS, HASH_ID_PREFIX } from "../config";

const hashIds = new Hashids(
  HASH_IDS,
  10,
  "abcdefghijklmnopqrstuvwxyz1234567890"
);

/**
 * Capitalize each first letter in a string
 */
export const capitalizeEachFirstLetter = (string: string) =>
  (string = string
    .toLowerCase()
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.toLowerCase().substring(1))
    .join(" "));

/**
 * Capitalize the first letter of each word in a string
 */
export const capitalizeFirstAndLastLetter = (string: string) => {
  const words = string.split(" ");
  words[0] = capitalizeFirstLetter(words[0]);
  words[words.length - 1] = capitalizeFirstLetter(words[words.length - 1]);
  return words.join(" ");
};

/**
 * Capitalize the first letter of a string
 */
export const capitalizeFirstLetter = (string: string) =>
  string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);

/**
 * Convert a JS Date to MySQL-compatible datetime
 */
export const dateToDateTime = (date: Date) =>
  date
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

/**
 * Delete any sensitive information for a user like passwords and tokens
 */
export const deleteSensitiveInfoUser = (user: User) => {
  delete user.password;
  delete user.twoFactorSecret;
  return user;
};

/**
 * Anonymize an IP address
 */
export const anonymizeIpAddress = (ipAddress: string) =>
  anonymize(ipAddress) || ipAddress;

export const organizationUsernameToId = async (id: string) => {
  if (isNaN(Number(id))) {
    return await getOrganizationIdFromUsername(id);
  } else {
    return hashIdToId(id);
  }
};

export const userUsernameToId = async (id: string, tokenUserId: string) => {
  if (id === "me") {
    return tokenUserId;
  } else if (isNaN(Number(id))) {
    return await getUserIdFromUsername(id);
  } else {
    return hashIdToId(id);
  }
};

export const generateHashId = (id: string) =>
  `${HASH_ID_PREFIX}${hashIds.encode(id)}`;

export const hashIdToId = (id: string | number): string => {
  if (typeof id === "number") return id.toString();
  if (id.startsWith(HASH_ID_PREFIX)) {
    const numberId = parseInt(
      hashIds.decode(id.replace(HASH_ID_PREFIX, "")).join("")
    );
    if (isNaN(numberId)) {
      const newId = parseInt(id);
      if (isNaN(newId)) {
        return id;
      } else {
        return newId.toString();
      }
    } else {
      return numberId.toString();
    }
  }
  return id;
};

export const localsToTokenOrKey = (res: Response) => {
  if (res.locals.token.sub == Tokens.API_KEY) {
    return res.locals.token as ApiKeyResponse;
  }
  return res.locals.token.id as string;
};

export const createSlug = (name?: string) =>
  name
    ? `${slugify(name, {
        lower: true
      }).replace(/'|"/g, "")}-${cryptoRandomString({ length: 5 })}`
    : cryptoRandomString({ length: 10 });

export const safeRedirect = (req: Request, res: Response, url: string) => {
  if (req.get("X-Requested-With") === "XMLHttpRequest")
    return res.json({ redirect: url });
  return res.redirect(url);
};

export const getCodeFromRequest = (req: Request) => {
  const code =
    req.body.code || (req.get("Authorization") || "").replace("Bearer ", "");
  joiValidate({ code: Joi.string().required() }, { code });
  return code;
};

/**
 * Detect the language of a text block
 */
export const detectTextLanguage = (text: string) => {
  const lang = new LanguageDetect();
  const detections = lang.detect(text, 1);
  if (detections.length) {
    try {
      return ISO6391.getCode(detections[0][0]) || "en";
    } catch (error) {}
  }
  return "en";
};

/**
 * MySQL columns which are booleans
 */
export const boolValues = [
  "twoFactorEnabled",
  "prefersReducedMotion",
  "prefersColorSchemeDark",
  "used",
  "isVerified",
  "forceTwoFactor",
  "autoJoinDomain",
  "onlyAllowDomain",
  "isActive",
  "checkLocationOnLogin"
];

/**
 * MySQL columns which are datetime values
 */
export const dateValues = [
  "createdAt",
  "updatedAt",
  "lastFiredAt",
  "expiresAt",
  "eventsUpdatedAt"
];

/**
 * MySQL columns which are JSON values
 */
export const jsonValues = [
  "data",
  "customCss",
  "variables",
  "links",
  "layout",
  "integrations",
  "protectedInfo"
];

/**
 * MySQL columns which are read-only
 */
export const readOnlyValues = [
  "createdAt",
  "id",
  "jwtApiKey",
  "userId",
  "organizationId"
];

/**
 * MySQL columns which are for int IDs
 */
export const IdValues = [
  "id",
  "userId",
  "organizationId",
  "primaryEmail",
  "apiKeyId",
  "apiKeyOrganizationId"
];

export const joiValidate = (schemaMap: Joi.SchemaMap, data: any) => {
  const schema = Joi.object().keys(schemaMap);
  const result = schema.validate(data);
  if (result.error) throw new Error(`joi:${JSON.stringify(result.error)}`);
  return true;
};

export const getElasticSearchFilterFromValue = (value: string) => {
  const filter = (value || "")
    .split(",")
    .map(i => i.trim())
    .filter(i => !!i)
    .map(i => {
      let key = i;
      let value = i;
      if (i.includes(":")) {
        key = i.split(":")[0].trim();
        value = i.split(":")[1].trim();
      }
      const match: {
        [index: string]: string;
      } = {};
      match[key] = value;
      return { match };
    });
  return filter;
};

/**
 * Find the average of an array of numbers
 */
export const average = (arr: number[]) => {
  let sum = 0;
  arr.forEach(n => (sum += n));
  return sum / arr.length;
};
export const removeFalsyValues = (value: any) => {
  if (value && typeof value === "object") {
    Object.keys(value).map(key => {
      if (!value[key]) delete value[key];
    });
  }
  return value;
};

export const includesDomainInCommaList = (commaList: string, value: string) => {
  const list = commaList.split(",").map(item => item.trim());
  let includes = false;
  list.forEach(item => {
    if (item === value || isMatch(value, `*.${item}`) || item === "*")
      includes = true;
  });
  return includes;
};

export const dnsResolve = (
  hostname: string,
  recordType:
    | "A"
    | "AAAA"
    | "ANY"
    | "CNAME"
    | "MX"
    | "NAPTR"
    | "NS"
    | "PTR"
    | "SOA"
    | "SRV"
    | "TXT"
): Promise<
  | string[]
  | dns.MxRecord[]
  | dns.NaptrRecord[]
  | dns.SoaRecord
  | dns.SrvRecord[]
  | string[][]
  | dns.AnyRecord[]
> =>
  new Promise((resolve, reject) => {
    dns.resolve(hostname, recordType, (error, records) => {
      if (error) return reject(error);
      resolve(records);
    });
  });

export const getVoiceFromLanguage = (code: string) => {
  const languages: { [index: string]: string } = {
    en: "Joanna",
    ar: "Zeina",
    zh: "Zhiyu",
    da: "Naja",
    nl: "Lotte",
    hi: "Aditi",
    fr: "Celine",
    de: "Vicki",
    is: "Dora",
    it: "Bianca",
    jp: "Mizuki",
    ko: "Seoyeon",
    np: "Liv",
    pl: "Maja",
    pt: "Ines",
    es: "Lucia",
    ro: "Carmen",
    ru: "Tatyana",
    sv: "Penelope",
    tr: "Filiz",
    cy: "Gwyneth",
    "en-US": "Joanna",
    "en-GB": "Amy",
    "en-IN": "Aditi",
    "en-AU": "Nicole",
    "en-GBR": "Geraint",
    "fr-FR": "Celine",
    "fr-CA": "Chantal",
    "pt-PT": "Ines",
    "pt-BR": "Vitoria",
    "es-ES": "Lucia",
    "es-MX": "Mia",
    "es-US": "Penelope"
  };
  if (languages[code]) return languages[code];
  const splitCode = code.split("-")[0];
  if (languages[splitCode]) return languages[splitCode];
  return "Joanna";
};

export const generateSSMLString = (text: string, playbackSpeed: number) => {
  let ssmlString = "";
  let sentences = text.split(".");
  let sightWordPlaybackSpeed = `${0.8 * playbackSpeed * 100}%`;
  let playbackSpeedPercentage = `${playbackSpeed * 100}%`;
  sentences.forEach(sentence => {
    let sentenceSSML = "";
    sentence.split(" ").forEach(word => {
      if (dyslexiaSightWords.has(word) || word.length > 8) {
        sentenceSSML += ` <prosody volume="loud" rate="${sightWordPlaybackSpeed}">${word}</prosody> `;
      } else {
        sentenceSSML += ` ${word} `;
      }
    });
    ssmlString += `<s> <prosody rate="${playbackSpeedPercentage}"> ${sentenceSSML} </prosody> </s>`;
  });
  ssmlString = `<speak> 
  ${ssmlString} 
  </speak>`;
  return ssmlString;
};

const dyslexiaSightWords = new Set(
  `a
about
after
again
all
always
am
an
and
any
apple
are
around
as
ask
at
ate
away
baby
back
ball
be
bear
because
bed
been
before
bell
best
better
big
bird
birthday
black
blue
boat
both
box
boy
bread
bring
brother
brown
but
buy
by
cake
call
came
can
car
carry
cat
chair
chicken
children
Christmas
clean
coat
cold
come
corn
could
cow
cut
day
did
do
does
dog
doll
done
don’t
door
down
draw
drink
duck
eat
egg
eight
every
eye
fall
far
farm
farmer
fast
father
feet
find
fire
first
fish
five
floor
flower
fly
for
found
four
from
full
funny
game
garden
gave
get
girl
give
go
goes
going
good
goodbye
got
grass
green
ground
grow
had
hand
has
have
he
head
help
her
here
hill
him
his
hold
home
horse
hot
house
how
hurt
I
if
in
into
is
it
its
jump
just
keep
kind
kitty
know
laugh
leg
let
letter
light
like
little
live
long
look
made
make
man
many
may
me
men
milk
money
morning
mother
much
must
my
myself
name
nest
never
new
night
no
not
now
of
off
old
on
once
one
only
open
or
our
out
over
own
paper
party
pick
picture
pig
play
please
pretty
pull
put
rabbit
rain
ran
read
red
ride
right
ring
robin
round
run
said
Santa Claus
saw
say
school
see
seed
seven
shall
she
sheep
shoe
show
sing
sister
sit
six
sleep
small
snow
so
some
song
soon
squirrel
start
stick
stop
street
sun
table
take
tell
ten
thank
that
the
their
them
then
there
these
they
thing
think
this
those
three
time
to
today
together
too
top
toy
tree
try
two
under
up
upon
us
use
very
walk
want
warm
was
wash
watch
water
way
we
well
went
were
what
when
where
which
white
who
why
will
wind
window
wish
with
wood
work
would
write
yellow
yes
you
your`.split("\n")
);
