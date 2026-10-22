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
      0.0297,
      1
    ],
    "avgNumber": [
      1.9009,
      2.9315
    ],
    "density": [
      0.0381,
      0.2197
    ]
  },
  "buckets": {
    "10-19": {
      "nodes": [
        0.301,
        0.4771
      ],
      "logicShare": [
        0.4639,
        1
      ],
      "avgNumber": [
        1.8462,
        2.9236
      ],
      "density": [
        0.0343,
        0.0816
      ],
      "scorePercentiles": [
        0.0192,
        0.0492,
        0.1143,
        0.1843,
        0.2793
      ]
    },
    "20-29": {
      "nodes": [
        0.301,
        0.699
      ],
      "logicShare": [
        0.3465,
        1
      ],
      "avgNumber": [
        2,
        2.8696
      ],
      "density": [
        0.0455,
        0.1303
      ],
      "scorePercentiles": [
        0.0648,
        0.1001,
        0.1628,
        0.2783,
        0.3783
      ]
    },
    "30-39": {
      "nodes": [
        0.301,
        0.9031
      ],
      "logicShare": [
        0.2281,
        1
      ],
      "avgNumber": [
        2.0555,
        2.8245
      ],
      "density": [
        0.0624,
        0.1888
      ],
      "scorePercentiles": [
        0.1214,
        0.1527,
        0.2619,
        0.3892,
        0.4758
      ]
    },
    "40-59": {
      "nodes": [
        0.301,
        1.1461
      ],
      "logicShare": [
        0.0604,
        1
      ],
      "avgNumber": [
        2.0465,
        2.8148
      ],
      "density": [
        0.087,
        0.2253
      ],
      "scorePercentiles": [
        0.1764,
        0.2287,
        0.3724,
        0.5152,
        0.6115
      ]
    },
    "60-79": {
      "nodes": [
        0.7782,
        1.6435
      ],
      "logicShare": [
        0.0656,
        0.4812
      ],
      "avgNumber": [
        2.0655,
        2.3082
      ],
      "density": [
        0.1284,
        0.2041
      ],
      "scorePercentiles": [
        0.4231,
        0.5002,
        0.5701,
        0.6367,
        0.7018
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
      "scorePercentiles": [
        0.5939,
        0.6774,
        0.7388,
        0.7986,
        0.8388
      ]
    }
  },
  "bands": [
    0.1436,
    0.2521,
    0.4545,
    0.6248
  ]
};

export default CALIBRATION;
