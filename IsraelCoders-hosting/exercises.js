// כל האזורים והמשימות של Israel Coders — מסע ביער הקוד.
// בכל טסט: inputs = מה שהמשתמש "מקליד", expected = הפלט המדויק (בלי טקסט ההנחיה של input).
// כל משימה מתחילה בעורך ריק — את הקוד כותבים לבד.
const STARTER = '# כתבו כאן את הקוד שלכם\n';

const CHAPTERS = [
  {
    id: '01',
    title: 'צעדים ראשונים ביער',
    missions: [
      {
        id: 'owl-call',
        title: 'קריאת הינשוף',
        concept: 'print',
        description: 'ינשוף מקבל את פני כל מי שנכנס ליער. כתבו תוכנית שמדפיסה בדיוק את קריאת הברכה שלו.',
        example: { input: '—', output: 'Hoo hoo! Welcome to the forest' },
        tests: [{ inputs: [], expected: 'Hoo hoo! Welcome to the forest' }],
        hints: [
          'איזו פקודה בפייתון מציגה טקסט על המסך?',
          'טקסט בפייתון נכתב בתוך מרכאות, ואת מה שמדפיסים שמים בתוך סוגריים.',
          'השוו אות אחר אות לדוגמה: סימן הקריאה, הרווחים והאות הגדולה בהתחלה.'
        ]
      },
      {
        id: 'ranger-badge',
        title: 'תג סייר',
        concept: 'input, f-string',
        description: 'כל סייר חדש מקבל תג. קלטו את שם הסייר ואת הגיל שלו, והדפיסו את התג שלו.',
        example: { input: 'Noa, 14', output: 'Ranger Noa, age 14, is ready!' },
        tests: [
          { inputs: ['Noa', '14'], expected: 'Ranger Noa, age 14, is ready!' },
          { inputs: ['Omer', '11'], expected: 'Ranger Omer, age 11, is ready!' }
        ],
        hints: [
          'כמה פרטים צריך לקבל מהמשתמש? כל פרט נקלט בנפרד.',
          'שמרו כל פרט במשתנה משלו. איך משלבים משתנים בתוך משפט אחד?',
          'ב-f-string שמים f לפני המרכאות, ואת שמות המשתנים בתוך סוגריים מסולסלים.'
        ]
      },
      {
        id: 'forest-years',
        title: 'עוד חמש שנים ביער',
        concept: 'int()',
        description: 'קלטו את גיל המשתמש והדפיסו בן כמה הוא יהיה בעוד 5 שנים.',
        example: { input: '14', output: 'In 5 years you will be 19' },
        tests: [
          { inputs: ['14'], expected: 'In 5 years you will be 19' },
          { inputs: ['95'], expected: 'In 5 years you will be 100' }
        ],
        hints: [
          'מה הטיפוס של הערך ש-input מחזיר? אפשר לבדוק עם type.',
          'אי אפשר לעשות חשבון עם טקסט. איזו פונקציה הופכת טקסט למספר שלם?',
          'אחרי שהגיל הוא מספר, אפשר להוסיף לו 5 ולהדפיס עם f-string.'
        ]
      },
      {
        id: 'mushroom-baskets',
        title: 'סלי פטריות',
        concept: 'פעולות חשבון',
        description: 'אספתם כמה סלים, ובכל סל אותה כמות פטריות. קלטו כמה פטריות יש בכל סל ואת מספר הסלים, והדפיסו כמה פטריות יש בסך הכל.',
        example: { input: '12, 3', output: 'Total mushrooms: 36' },
        tests: [
          { inputs: ['12', '3'], expected: 'Total mushrooms: 36' },
          { inputs: ['9', '0'], expected: 'Total mushrooms: 0' }
        ],
        hints: [
          'כמה ערכים צריך לקלוט, ואיזה טיפוס הם צריכים להיות?',
          'איזה סימן משמש בפייתון לכפל?',
          'בדקו את פורמט ההדפסה: Total mushrooms, נקודתיים, רווח, ואז המספר.'
        ]
      }
    ]
  },
  {
    id: '02',
    title: 'צומת שבילים',
    missions: [
      {
        id: 'day-night',
        title: 'יום או לילה',
        concept: 'if / else',
        description: 'קלטו שעה (מספר בין 0 ל-23). אם השעה היא 6 או יותר וגם פחות מ-18 — הדפיסו Day. אחרת הדפיסו Night.',
        example: { input: '20', output: 'Night' },
        tests: [
          { inputs: ['20'], expected: 'Night' },
          { inputs: ['6'], expected: 'Day' },
          { inputs: ['17'], expected: 'Day' },
          { inputs: ['18'], expected: 'Night' },
          { inputs: ['0'], expected: 'Night' }
        ],
        hints: [
          'יש כאן שני גבולות. מה צריך להתקיים כדי שזה יהיה יום?',
          'אפשר לחבר שני תנאים עם and, ובפייתון אפשר גם לכתוב השוואה כפולה.',
          'שימו לב לגבולות: 6 הוא יום אבל 18 כבר לילה. איזה אופרטור כולל את הגבול ואיזה לא?'
        ]
      },
      {
        id: 'tree-height',
        title: 'מד גובה עצים',
        concept: 'if / elif / else',
        description: 'קלטו גובה של עץ במטרים. אם הוא 30 ומעלה הדפיסו Giant, אם 10 ומעלה הדפיסו Tall, ואחרת הדפיסו Small.',
        example: { input: '12', output: 'Tall' },
        tests: [
          { inputs: ['45'], expected: 'Giant' },
          { inputs: ['30'], expected: 'Giant' },
          { inputs: ['10'], expected: 'Tall' },
          { inputs: ['3'], expected: 'Small' }
        ],
        hints: [
          'יש שלוש אפשרויות. איזה מבנה בודק כמה תנאים אחד אחרי השני?',
          'הסדר חשוב: אם תבדקו קודם "10 ומעלה", מה יקרה לעץ בגובה 45?',
          'האם 30 צריך להיחשב Giant? איזה אופרטור כולל את הגבול?'
        ]
      }
    ]
  },
  {
    id: '03',
    title: 'מעגלי היער',
    missions: [
      {
        id: 'count-trees',
        title: 'ספירת עצים',
        concept: 'for, range',
        description: 'קלטו מספר n והדפיסו שורה לכל עץ, מ-Tree 1 ועד Tree n.',
        example: { input: '3', output: 'Tree 1\nTree 2\nTree 3' },
        tests: [
          { inputs: ['3'], expected: 'Tree 1\nTree 2\nTree 3' },
          { inputs: ['1'], expected: 'Tree 1' },
          { inputs: ['5'], expected: 'Tree 1\nTree 2\nTree 3\nTree 4\nTree 5' }
        ],
        hints: [
          'איזו לולאה מתאימה כשיודעים מראש כמה פעמים לחזור?',
          'נסו להדפיס את list(range(4)). מאיזה מספר זה מתחיל ובאיזה נגמר?',
          'range יכול לקבל התחלה וסוף, והסוף לא נכלל. מה צריך לבקש כדי ש-n ייכלל?'
        ]
      },
      {
        id: 'acorn-pile',
        title: 'ערימת בלוטים',
        concept: 'צובר',
        description: 'ביום הראשון סנאי אוסף בלוט אחד, ביום השני 2, ביום השלישי 3, וכן הלאה. קלטו מספר ימים n והדפיסו כמה בלוטים הוא אסף בסך הכל.',
        example: { input: '4', output: 'Acorns: 10' },
        tests: [
          { inputs: ['4'], expected: 'Acorns: 10' },
          { inputs: ['1'], expected: 'Acorns: 1' },
          { inputs: ['100'], expected: 'Acorns: 5050' }
        ],
        hints: [
          'דמיינו שאתם סופרים בראש יום אחרי יום. מה אתם זוכרים בכל שלב?',
          'צרו משתנה שמתחיל ב-0 לפני הלולאה. מה קורה לו בכל סיבוב?',
          'איפה צריכה להיות ההדפסה — בתוך הלולאה או אחריה?'
        ]
      },
      {
        id: 'countdown',
        title: 'ספירה לאחור',
        concept: 'range עם צעד',
        description: 'הסיירים יוצאים למסע! קלטו מספר n, הדפיסו ספירה לאחור מ-n עד 1 (כל מספר בשורה), ובסוף הדפיסו Go!',
        example: { input: '3', output: '3\n2\n1\nGo!' },
        tests: [
          { inputs: ['3'], expected: '3\n2\n1\nGo!' },
          { inputs: ['1'], expected: '1\nGo!' },
          { inputs: ['5'], expected: '5\n4\n3\n2\n1\nGo!' }
        ],
        hints: [
          'הפעם הספירה הולכת אחורה. האם range יודע לספור גם כלפי מטה?',
          'ל-range יש פרמטר שלישי: הצעד. מה יקרה אם הצעד יהיה שלילי?',
          'בדקו מתי הלולאה נעצרת: האם 1 מודפס? ואיפה צריך להיות Go!?'
        ]
      }
    ]
  },
  {
    id: '04',
    title: 'סודות במחרוזות ורשימות',
    missions: [
      {
        id: 'secret-message',
        title: 'מסר מוצפן',
        concept: 'מחרוזות',
        description: 'השועל משאיר מסרים כתובים הפוך. קלטו מילה והדפיסו אותה הפוכה כדי לפענח אותה.',
        example: { input: 'tserof', output: 'forest' },
        tests: [
          { inputs: ['tserof'], expected: 'forest' },
          { inputs: ['lwo'], expected: 'owl' },
          { inputs: ['a'], expected: 'a' }
        ],
        hints: [
          'מחרוזת היא רצף של תווים, ולכל תו יש מיקום.',
          'אפשר לבנות מחרוזת חדשה בלולאה, או להשתמש בחיתוך (slicing). מה מכירים?',
          'בחיתוך [התחלה:סוף:צעד] — מה יקרה אם הצעד יהיה שלילי?'
        ]
      },
      {
        id: 'heaviest-acorn',
        title: 'הבלוט הכבד ביותר',
        concept: 'לולאות והשוואות',
        description: 'קלטו את המשקל של 5 בלוטים (מספר שלם בכל שורה) והדפיסו את הכבד ביותר — בלי להשתמש בפונקציה max!',
        example: { input: '4, 9, 2, 7, 1', output: 'Heaviest: 9' },
        tests: [
          { inputs: ['4', '9', '2', '7', '1'], expected: 'Heaviest: 9' },
          { inputs: ['-5', '-2', '-9', '-3', '-8'], expected: 'Heaviest: -2' },
          { inputs: ['3', '3', '3', '3', '3'], expected: 'Heaviest: 3' }
        ],
        forbids: [{ pattern: /\bmax\s*\(/, message: 'הפעם בלי max — מוצאים את הכבד ביותר לבד!' }],
        hints: [
          'איך מוצאים את הכבד מבין 5 בלוטים אם מותר להסתכל רק על אחד בכל פעם?',
          'החזיקו משתנה "הכבד עד עכשיו". מה הערך ההתחלתי הכי בטוח שלו, גם כשיש מספרים שליליים?',
          'בכל סיבוב: אם הבלוט החדש כבד יותר מ"הכבד עד עכשיו" — מה עושים?'
        ]
      }
    ]
  },
  {
    id: '05',
    title: 'שבילים בלי סוף',
    missions: [
      {
        id: 'gate-password',
        title: 'שער הסיסמה',
        concept: 'while',
        description: 'השער ליער הפנימי נפתח רק עם הסיסמה owl. קלטו ניסיונות שוב ושוב עד שהמשתמש מקליד owl, ואז הדפיסו כמה ניסיונות זה לקח.',
        example: { input: 'fox, bear, owl', output: 'Gate open! Tries: 3' },
        tests: [
          { inputs: ['fox', 'bear', 'owl'], expected: 'Gate open! Tries: 3' },
          { inputs: ['owl'], expected: 'Gate open! Tries: 1' },
          { inputs: ['a', 'b', 'c', 'd', 'owl'], expected: 'Gate open! Tries: 5' }
        ],
        requires: [{ pattern: /\bwhile\b/, message: 'במשימה הזו משתמשים בלולאת while.' }],
        hints: [
          'מראש לא יודעים כמה ניסיונות יהיו. איזו לולאה ממשיכה "כל עוד" משהו נכון?',
          'צריך גם משתנה שסופר ניסיונות. מתי הוא גדל?',
          'בדקו שהניסיון הראשון נספר, ושאחרי כל ניסיון שגוי קולטים ניסיון חדש בתוך הלולאה.'
        ]
      },
      {
        id: 'halving',
        title: 'קפיצות הסנאי',
        concept: 'while + //',
        description: 'סנאי עומד במרחק n צעדים מהעץ. בכל קפיצה המרחק שנשאר נהיה חצי ממה שהיה (בחילוק שלם עם //). קלטו n והדפיסו כמה קפיצות לוקח עד שהמרחק מגיע ל-0.',
        example: { input: '8', output: 'Jumps: 4' },
        tests: [
          { inputs: ['8'], expected: 'Jumps: 4' },
          { inputs: ['1'], expected: 'Jumps: 1' },
          { inputs: ['100'], expected: 'Jumps: 7' }
        ],
        requires: [{ pattern: /\bwhile\b/, message: 'במשימה הזו משתמשים בלולאת while.' }],
        hints: [
          'נסו על דף עם 8: אחרי כל קפיצה, מה המרחק החדש? מתי עוצרים?',
          'הלולאה ממשיכה כל עוד המרחק גדול מ-0. מה משתנה בכל סיבוב — ומה עוד צריך לספור?',
          'בכל סיבוב יש שני עדכונים: המרחק (חילוק שלם ב-2) ומונה הקפיצות.'
        ]
      }
    ]
  },
  {
    id: '06',
    title: 'כלים של סייר',
    missions: [
      {
        id: 'area-func',
        title: 'שטח החלקה',
        concept: 'def, return',
        description: 'כתבו פונקציה בשם area שמקבלת אורך ורוחב ומחזירה את השטח (אורך כפול רוחב). קלטו שני מספרים, קראו לפונקציה, והדפיסו את התוצאה.',
        example: { input: '4, 5', output: 'Area: 20' },
        tests: [
          { inputs: ['4', '5'], expected: 'Area: 20' },
          { inputs: ['7', '1'], expected: 'Area: 7' },
          { inputs: ['0', '9'], expected: 'Area: 0' }
        ],
        requires: [
          { pattern: /\bdef\s+area\s*\(/, message: 'צריך להגדיר פונקציה בשם area עם def.' },
          { pattern: /\breturn\b/, message: 'הפונקציה צריכה להחזיר את התוצאה עם return.' }
        ],
        hints: [
          'פונקציה מגדירים עם def, שם, וסוגריים עם הפרמטרים. כמה פרמטרים יש ל-area?',
          'בתוך הפונקציה מחשבים, ו-return מחזיר את התוצאה למי שקרא לה.',
          'מחוץ לפונקציה: קולטים שני מספרים, קוראים ל-area איתם, ומדפיסים את מה שחזר.'
        ]
      },
      {
        id: 'ancient-tree',
        title: 'עץ עתיק?',
        concept: 'פונקציה שמחזירה True/False',
        description: 'כתבו פונקציה בשם is_ancient שמקבלת גיל של עץ ומחזירה True אם הגיל 100 ומעלה, ואחרת False. קלטו גיל, והדפיסו Ancient tree אם הפונקציה החזירה True, ואחרת Young tree.',
        example: { input: '150', output: 'Ancient tree' },
        tests: [
          { inputs: ['150'], expected: 'Ancient tree' },
          { inputs: ['100'], expected: 'Ancient tree' },
          { inputs: ['99'], expected: 'Young tree' }
        ],
        requires: [{ pattern: /\bdef\s+is_ancient\s*\(/, message: 'צריך להגדיר פונקציה בשם is_ancient עם def.' }],
        hints: [
          'השוואה כמו age >= 100 היא בעצמה True או False. מה אפשר לעשות איתה בתוך return?',
          'מחוץ לפונקציה, אפשר לשים את הקריאה לפונקציה ישר בתוך if.',
          'בדקו את הגבול: האם עץ בן 100 בדיוק נחשב עתיק?'
        ]
      }
    ]
  },
  {
    id: '07',
    title: 'רשימות בתרמיל',
    missions: [
      {
        id: 'backpack',
        title: 'התרמיל',
        concept: 'list, append',
        description: 'קלטו מספר n, ואז n פריטים (פריט בכל שורה). שמרו אותם ברשימה, ובסוף הדפיסו כל פריט עם מספר לפניו.',
        example: { input: '3, map, rope, apple', output: '1. map\n2. rope\n3. apple' },
        tests: [
          { inputs: ['3', 'map', 'rope', 'apple'], expected: '1. map\n2. rope\n3. apple' },
          { inputs: ['1', 'water'], expected: '1. water' },
          { inputs: ['4', 'a', 'b', 'c', 'd'], expected: '1. a\n2. b\n3. c\n4. d' }
        ],
        requires: [{ pattern: /\[\s*\]|\blist\s*\(/, message: 'שמרו את הפריטים ברשימה (רשימה ריקה מתחילה ב-[]).' }],
        hints: [
          'יש כאן שני שלבים: קודם אוספים את כל הפריטים, ואז מדפיסים. מה צריך להתחיל לפני האיסוף?',
          'append מוסיף פריט לסוף הרשימה. כמה פעמים צריך לקלוט ולהוסיף?',
          'בהדפסה צריך גם מספר. אפשר להחזיק מונה משלכם, או להשתמש ב-range על אורך הרשימה.'
        ]
      },
      {
        id: 'acorn-average',
        title: 'ממוצע הבלוטים',
        concept: 'sum, len',
        description: 'קלטו מספר n, ואז n משקלים של בלוטים (מספר שלם בכל שורה). הדפיסו את המשקל הממוצע.',
        example: { input: '2, 4, 5', output: 'Average: 4.5' },
        tests: [
          { inputs: ['2', '4', '5'], expected: 'Average: 4.5' },
          { inputs: ['3', '2', '4', '6'], expected: 'Average: 4.0' },
          { inputs: ['1', '7'], expected: 'Average: 7.0' }
        ],
        hints: [
          'ממוצע = סכום כל המשקלים חלקי כמה משקלים יש. מה צריך לאסוף קודם?',
          'אם שומרים את המשקלים ברשימה, יש פונקציות מוכנות לסכום ולאורך.',
          'שימו לב: חילוק רגיל עם / תמיד נותן מספר עשרוני, כמו 4.0 — וזה בדיוק מה שצריך.'
        ]
      }
    ]
  },
  {
    id: '08',
    title: 'מילון היער',
    missions: [
      {
        id: 'animal-sounds',
        title: 'קולות היער',
        concept: 'dict',
        description: 'צרו מילון שמתאים לכל חיה את הקול שלה: לינשוף (owl) הקול Hoo, לשועל (fox) הקול Yip, ולדוב (bear) הקול Grr. קלטו שם של חיה והדפיסו את הקול שלה. אם החיה לא במילון, הדפיסו Unknown.',
        example: { input: 'fox', output: 'Yip' },
        tests: [
          { inputs: ['owl'], expected: 'Hoo' },
          { inputs: ['bear'], expected: 'Grr' },
          { inputs: ['cat'], expected: 'Unknown' }
        ],
        requires: [{ pattern: /\{[^}]*:/, message: 'השתמשו במילון: סוגריים מסולסלים עם מפתח: ערך.' }],
        hints: [
          'מילון מחבר מפתח לערך. מה המפתחות כאן ומה הערכים?',
          'לפני שלוקחים ערך מהמילון, אפשר לבדוק אם המפתח בכלל קיים. איזו מילה בודקת "נמצא בתוך"?',
          'חיה שלא קיימת במילון תגרום לשגיאה אם ניגשים אליה ישר. איך מטפלים במקרה הזה?'
        ]
      },
      {
        id: 'word-count',
        title: 'ספירת מילים',
        concept: 'dict כמונה',
        description: 'קלטו משפט אחד. ספרו כמה פעמים מופיעה כל מילה, והדפיסו כל מילה עם המספר שלה, לפי הסדר שבו המילים הופיעו לראשונה.',
        example: { input: 'owl fox owl', output: 'owl: 2\nfox: 1' },
        tests: [
          { inputs: ['owl fox owl'], expected: 'owl: 2\nfox: 1' },
          { inputs: ['a b c'], expected: 'a: 1\nb: 1\nc: 1' },
          { inputs: ['tree tree tree'], expected: 'tree: 3' }
        ],
        hints: [
          'קודם צריך לפרק את המשפט למילים נפרדות. איזו פעולה עושה את זה?',
          'מילון יכול לשמש כמונה: המילה היא המפתח, והמספר הוא הערך. מה עושים כשפוגשים מילה בפעם הראשונה?',
          'מילון זוכר את סדר ההכנסה, אז לולאה על המילון תדפיס לפי הסדר שבו המילים הופיעו.'
        ]
      }
    ]
  },
  {
    id: '09',
    title: 'משימת הסיום',
    missions: [
      {
        id: 'ranger-report',
        title: 'דו"ח הסיירים',
        concept: 'הכל ביחד',
        description: 'קלטו מספר n, ואז n שורות. בכל שורה יש שם של סייר ומספר הנקודות שלו, עם רווח ביניהם (למשל Noa 90). הדפיסו את הסייר עם הכי הרבה נקודות, ואז את ממוצע הנקודות.',
        example: { input: '3, Noa 90, Omer 75, Dana 81', output: 'Best: Noa (90)\nAverage: 82.0' },
        tests: [
          { inputs: ['3', 'Noa 90', 'Omer 75', 'Dana 81'], expected: 'Best: Noa (90)\nAverage: 82.0' },
          { inputs: ['2', 'Ari 50', 'Tal 70'], expected: 'Best: Tal (70)\nAverage: 60.0' },
          { inputs: ['1', 'Lee 100'], expected: 'Best: Lee (100)\nAverage: 100.0' }
        ],
        hints: [
          'פרקו את הבעיה לשלבים: לקרוא כל שורה, להפריד שם ממספר, לזכור את הטוב ביותר, ולצבור סכום.',
          'split מפרק שורה לחלקים לפי רווחים. איזה חלק הוא השם, ואיזה צריך להפוך למספר?',
          'כמו במשימת הבלוט הכבד: משתנה "הטוב עד עכשיו" — אבל הפעם צריך לזכור גם את השם שלו.'
        ]
      }
    ]
  }
];
