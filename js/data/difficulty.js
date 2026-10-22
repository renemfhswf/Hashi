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
      1.9257
    ],
    "logicShare": [
      0.0299,
      1
    ],
    "avgNumber": [
      2,
      2.7362
    ],
    "density": [
      0.0526,
      0.2644
    ]
  },
  "buckets": {
    "10-19": {
      "nodes": [
        0.301,
        0.6021
      ],
      "logicShare": [
        0.2141,
        1
      ],
      "avgNumber": [
        2,
        2.6271
      ],
      "density": [
        0.0469,
        0.1364
      ]
    },
    "20-29": {
      "nodes": [
        0.301,
        0.699
      ],
      "logicShare": [
        0.2488,
        1
      ],
      "avgNumber": [
        2.0769,
        2.7204
      ],
      "density": [
        0.0692,
        0.2149
      ]
    },
    "30-39": {
      "nodes": [
        0.301,
        0.9031
      ],
      "logicShare": [
        0.2173,
        1
      ],
      "avgNumber": [
        2.121,
        2.6505
      ],
      "density": [
        0.0991,
        0.2637
      ]
    },
    "40-59": {
      "nodes": [
        0.301,
        1.1476
      ],
      "logicShare": [
        0.1262,
        1
      ],
      "avgNumber": [
        2.1957,
        2.6004
      ],
      "density": [
        0.1455,
        0.2649
      ]
    },
    "60-79": {
      "nodes": [
        0.7782,
        1.5911
      ],
      "logicShare": [
        0.0742,
        0.6208
      ],
      "avgNumber": [
        2.0825,
        2.344
      ],
      "density": [
        0.1283,
        0.2397
      ]
    },
    "80-120": {
      "nodes": [
        1.1461,
        2.1019
      ],
      "logicShare": [
        0.0213,
        0.3611
      ],
      "avgNumber": [
        2.1029,
        2.313
      ],
      "density": [
        0.176,
        0.207
      ]
    }
  },
  "bands": [
    0.1632,
    0.3233,
    0.4664,
    0.6078
  ]
};

export default CALIBRATION;
