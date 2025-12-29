const OPERATOR_NUMBER_PREFIX = {
  cm: {
    orange: [
      "655",
      "656",
      "657",
      "658",
      "6590",
      "6591",
      "6592",
      "6593",
      "6594",
      "6595",
      "69",
    ],
    mtn: ["650", "651", "652", "653", "654", "67", "680", "681", "682", "683"],
  },
  sn: {
    orange: ["77", "78"],
    free: ["76"],
  },
  ci: {
    orange: ["07"],
    mtn: ["05"],
    moov: ["01"],
  },
  bf: {
    orange: [
      "05",
      "06",
      "07",
      "54",
      "55",
      "56",
      "57",
      "64",
      "65",
      "66",
      "67",
      "74",
      "75",
      "76",
      "77",
    ],
    moov: [
      "01",
      "02",
      "03",
      "50",
      "51",
      "52",
      "53",
      "60",
      "61",
      "62",
      "63",
      "70",
      "71",
      "72",
      "73",
    ],
  },
} as const satisfies {
  [key: string]: {
    [key: string]: string[];
  };
};

export function detectOperator(phoneNumber: string, countryAlpha2Code: string) {
  const countryData =
    OPERATOR_NUMBER_PREFIX[
      countryAlpha2Code.toLowerCase() as keyof typeof OPERATOR_NUMBER_PREFIX
    ];
  if (countryData) {
    for (const operator of Object.keys(countryData)) {
      const operatorData = countryData[operator as keyof typeof countryData];
      if (operatorData.some((value) => phoneNumber.startsWith(value))) {
        return operator;
      }
    }
  } else {
    return null;
  }
}
