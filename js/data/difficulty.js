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
      3.0835
    ],
    "logicShare": [
      0,
      1
    ],
    "avgNumber": [
      2,
      2.8438
    ],
    "density": [
      0.1037,
      0.4198
    ]
  },
  "buckets": {
    "10-19": {
      "nodes": [
        0.301,
        0.6021
      ],
      "logicShare": [
        0.2308,
        1
      ],
      "avgNumber": [
        1.8746,
        2.8354
      ],
      "density": [
        0.0972,
        0.2382
      ]
    },
    "20-29": {
      "nodes": [
        0.301,
        0.8451
      ],
      "logicShare": [
        0.1245,
        1
      ],
      "avgNumber": [
        2.0769,
        2.8
      ],
      "density": [
        0.1264,
        0.3092
      ]
    },
    "30-39": {
      "nodes": [
        0.301,
        1.3434
      ],
      "logicShare": [
        0.0208,
        1
      ],
      "avgNumber": [
        2.1209,
        2.7783
      ],
      "density": [
        0.1648,
        0.4198
      ]
    },
    "40-59": {
      "nodes": [
        0.699,
        1.9694
      ],
      "logicShare": [
        0,
        0.6434
      ],
      "avgNumber": [
        2.1275,
        2.6002
      ],
      "density": [
        0.2347,
        0.4198
      ]
    },
    "60-79": {
      "nodes": [
        1.0393,
        2.4457
      ],
      "logicShare": [
        0,
        0.3263
      ],
      "avgNumber": [
        2.0832,
        2.3389
      ],
      "density": [
        0.1883,
        0.3827
      ]
    },
    "80-120": {
      "nodes": [
        1.8247,
        3.3991
      ],
      "logicShare": [
        0,
        0.1717
      ],
      "avgNumber": [
        2.0889,
        2.2892
      ],
      "density": [
        0.2623,
        0.3086
      ]
    }
  },
  "bands": [
    0.223,
    0.407,
    0.5376,
    0.6354
  ]
};

export default CALIBRATION;
