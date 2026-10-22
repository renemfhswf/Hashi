/**
 * Referenzbereiche für die Schwierigkeitsmessung – erzeugt von
 * `npm run calibrate`. Bitte nach Änderungen am Generator neu erzeugen.
 *
 * Je Inselzahl-Bündel die 5- und 95-Perzentile der Metriken.
 */

export const CALIBRATION = {
  "global": {
    "nodes": [
      0.301,
      1.9769
    ],
    "logicShare": [
      0.0391,
      1
    ],
    "avgNumber": [
      2,
      2.7175
    ],
    "density": [
      0.0515,
      0.2727
    ]
  },
  "buckets": {
    "10-19": {
      "nodes": [
        0.301,
        0.4771
      ],
      "logicShare": [
        0.25,
        1
      ],
      "avgNumber": [
        1.8662,
        2.6271
      ],
      "density": [
        0.0478,
        0.1339
      ],
      "scoreRange": [
        0,
        0.4459
      ]
    },
    "20-29": {
      "nodes": [
        0.301,
        0.7029
      ],
      "logicShare": [
        0.275,
        1
      ],
      "avgNumber": [
        2.0798,
        2.7204
      ],
      "density": [
        0.068,
        0.2123
      ],
      "scoreRange": [
        0.0061,
        0.5371
      ]
    },
    "30-39": {
      "nodes": [
        0.301,
        0.8451
      ],
      "logicShare": [
        0.2218,
        1
      ],
      "avgNumber": [
        2.106,
        2.6169
      ],
      "density": [
        0.0991,
        0.2727
      ],
      "scoreRange": [
        0.0389,
        0.6051
      ]
    },
    "40-59": {
      "nodes": [
        0.301,
        1.1476
      ],
      "logicShare": [
        0.1795,
        1
      ],
      "avgNumber": [
        2.1875,
        2.6157
      ],
      "density": [
        0.1454,
        0.2727
      ],
      "scoreRange": [
        0.1382,
        0.6731
      ]
    },
    "60-79": {
      "nodes": [
        0.6021,
        1.6435
      ],
      "logicShare": [
        0.0816,
        0.6088
      ],
      "avgNumber": [
        2.0833,
        2.3614
      ],
      "density": [
        0.1284,
        0.2161
      ],
      "scoreRange": [
        0.162,
        0.7202
      ]
    },
    "80-120": {
      "nodes": [
        1.2027,
        2.1855
      ],
      "logicShare": [
        0.0259,
        0.3025
      ],
      "avgNumber": [
        2.1149,
        2.3335
      ],
      "density": [
        0.176,
        0.207
      ],
      "scoreRange": [
        0.5262,
        0.8313
      ]
    }
  },
  "bands": [
    0.1721,
    0.3085,
    0.462,
    0.6064
  ]
};

export default CALIBRATION;
