package me.amanullah.course.seed;

/** German lesson content used by the demo seed. */
final class SeedContent {

    private SeedContent() {
    }

    static final String A1_DESCRIPTION = """
            <p>Du lernst Deutsch von Anfang an – praxisnah und Schritt für Schritt. Nach diesem Kurs kannst du \
            dich vorstellen, einfache Fragen stellen und beantworten, mit Zahlen umgehen und kennst die wichtigsten \
            Grundlagen der Grammatik.</p>
            <ul><li>Begrüßen und verabschieden</li><li>Sich und andere vorstellen</li>\
            <li>Artikel: der, die, das</li><li>Zahlen, Wochentage und Uhrzeit</li></ul>
            <p>Für Lernende ohne Vorkenntnisse. Jede Woche wird eine neue Lektion freigeschaltet.</p>""";

    static final String B1_DESCRIPTION = """
            <p>Du sprichst schon gut Deutsch und willst jetzt sicherer werden – im Alltag und im Beruf. \
            Wir wiederholen das <strong>Perfekt</strong>, üben Bewerbungsgespräche und schreiben formelle \
            E-Mails.</p><p>Voraussetzung: abgeschlossenes Niveau A2.</p>""";

    static final String GREETINGS = """
            <h2>Hallo und Guten Tag!</h2>
            <p>Im Deutschen unterscheidet man zwischen <strong>formellen</strong> und <strong>informellen</strong> \
            Begrüßungen. Mit Freunden, Familie und Kindern bist du informell (<em>du</em>), mit Fremden, Kolleginnen \
            und Kollegen im Büro oder in Behörden formell (<em>Sie</em>).</p>
            <table><thead><tr><th>Tageszeit</th><th>formell</th><th>informell</th></tr></thead><tbody>
            <tr><td>morgens (bis ca. 10 Uhr)</td><td>Guten Morgen!</td><td>Morgen!</td></tr>
            <tr><td>tagsüber</td><td>Guten Tag!</td><td>Hallo! / Hi!</td></tr>
            <tr><td>abends (ab ca. 18 Uhr)</td><td>Guten Abend!</td><td>N'Abend!</td></tr>
            </tbody></table>
            <h3>Regionale Begrüßungen</h3>
            <ul><li><strong>Moin!</strong> – in Norddeutschland, zu jeder Tageszeit</li>
            <li><strong>Grüß Gott!</strong> – in Bayern und Österreich</li>
            <li><strong>Grüezi!</strong> – in der Schweiz</li></ul>
            <h3>Verabschieden</h3>
            <p><strong>Auf Wiedersehen!</strong> (formell) · <strong>Tschüss!</strong> (informell) · \
            <strong>Bis später! / Bis morgen!</strong> · <strong>Gute Nacht!</strong> (nur vor dem Schlafengehen)</p>
            <blockquote>Tipp: Wenn du unsicher bist, benutze <em>Sie</em> – das ist immer höflich.</blockquote>""";

    static final String INTRODUCE = """
            <p>Mit diesen Sätzen kannst du dich vorstellen:</p>
            <ul><li>Ich heiße Luca. / Mein Name ist Luca Rossi.</li>
            <li>Ich komme aus Italien. Ich komme aus Mailand.</li>
            <li>Ich wohne in Berlin.</li>
            <li>Ich bin Ingenieur von Beruf.</li>
            <li>Ich spreche Italienisch, Englisch und ein bisschen Deutsch.</li></ul>
            <h3>Fragen stellen</h3>
            <table><thead><tr><th>informell (du)</th><th>formell (Sie)</th></tr></thead><tbody>
            <tr><td>Wie heißt du?</td><td>Wie heißen Sie?</td></tr>
            <tr><td>Woher kommst du?</td><td>Woher kommen Sie?</td></tr>
            <tr><td>Wo wohnst du?</td><td>Wo wohnen Sie?</td></tr>
            <tr><td>Was machst du beruflich?</td><td>Was machen Sie beruflich?</td></tr>
            </tbody></table>
            <h3>Das Verb <em>sein</em></h3>
            <p>ich <strong>bin</strong> · du <strong>bist</strong> · er/sie/es <strong>ist</strong> · \
            wir <strong>sind</strong> · ihr <strong>seid</strong> · sie/Sie <strong>sind</strong></p>
            <p><em>Übung:</em> Schreibe fünf Sätze über dich und lies sie laut vor.</p>""";

    static final String ARTICLES = """
            <p>Jedes deutsche Nomen hat ein grammatisches Geschlecht (<em>Genus</em>): \
            <strong>maskulin</strong> (der), <strong>feminin</strong> (die) oder <strong>neutral</strong> (das). \
            Im Plural ist der Artikel immer <strong>die</strong>.</p>
            <p>Lerne jedes Nomen immer <strong>mit</strong> Artikel: nicht „Tisch“, sondern „der Tisch“.</p>
            <h3>Hilfreiche Regeln</h3>
            <table><thead><tr><th>Artikel</th><th>Endungen / Gruppen</th><th>Beispiele</th></tr></thead><tbody>
            <tr><td>der</td><td>-er (Personen), -ling, -ismus; Tage, Monate, Jahreszeiten</td>\
            <td>der Lehrer, der Frühling, der Montag</td></tr>
            <tr><td>die</td><td>-ung, -heit, -keit, -schaft, -ion, -tät, meist -e</td>\
            <td>die Zeitung, die Freiheit, die Lampe</td></tr>
            <tr><td>das</td><td>-chen, -lein, -ment, -um; Infinitive als Nomen</td>\
            <td>das Mädchen, das Zentrum, das Essen</td></tr>
            </tbody></table>
            <h3>Unbestimmter Artikel</h3>
            <p>der → <strong>ein</strong> Tisch · die → <strong>eine</strong> Lampe · das → <strong>ein</strong> Buch</p>
            <blockquote>Merke: Das natürliche und das grammatische Geschlecht sind nicht immer gleich – \
            <em>das Mädchen</em> ist neutral!</blockquote>""";

    static final String NUMBERS = """
            <p>0 null · 1 eins · 2 zwei · 3 drei · 4 vier · 5 fünf · 6 sechs · 7 sieben · 8 acht · 9 neun · 10 zehn</p>
            <p>11 elf · 12 zwölf · 13 dreizehn · 14 vierzehn · 15 fünfzehn · 16 <strong>sech</strong>zehn · \
            17 <strong>sieb</strong>zehn · 18 achtzehn · 19 neunzehn</p>
            <p>20 zwanzig · 30 drei<strong>ß</strong>ig · 40 vierzig · 50 fünfzig · 60 sechzig · 70 siebzig · \
            80 achtzig · 90 neunzig · 100 hundert</p>
            <h3>Die Einer zuerst!</h3>
            <p>Ab 21 sagt man zuerst die Einer, dann <em>und</em>, dann die Zehner: \
            21 = <strong>einundzwanzig</strong>, 35 = fünfunddreißig, 99 = neunundneunzig.</p>
            <h3>Im Alltag</h3>
            <ul><li>Telefonnummern liest man oft paarweise: 030 – 45 67 89 → null drei null, \
            fünfundvierzig, siebenundsechzig, neunundachtzig.</li>
            <li>Preise: 3,50 € → drei Euro fünfzig.</li></ul>""";

    static final String TIME = """
            <p>Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag (in Norddeutschland auch Sonnabend), Sonntag. \
            Alle Wochentage sind maskulin: <strong>der</strong> Montag. Präposition: <strong>am</strong> Montag.</p>
            <h3>Wie spät ist es?</h3>
            <table><thead><tr><th>Uhrzeit</th><th>offiziell</th><th>umgangssprachlich</th></tr></thead><tbody>
            <tr><td>8:00</td><td>acht Uhr</td><td>acht</td></tr>
            <tr><td>8:15</td><td>acht Uhr fünfzehn</td><td>Viertel nach acht</td></tr>
            <tr><td>8:30</td><td>acht Uhr dreißig</td><td><strong>halb neun</strong></td></tr>
            <tr><td>8:45</td><td>acht Uhr fünfundvierzig</td><td>Viertel vor neun</td></tr>
            </tbody></table>
            <blockquote>Achtung: „halb neun“ bedeutet 8:30, nicht 9:30!</blockquote>""";

    static final String PERFEKT = """
            <p>Wenn wir über die Vergangenheit <em>sprechen</em>, benutzen wir meistens das Perfekt:</p>
            <p><strong>haben/sein</strong> (konjugiert, Position 2) + <strong>Partizip II</strong> (am Satzende)</p>
            <ul><li>Ich <strong>habe</strong> gestern lange <strong>gearbeitet</strong>.</li>
            <li>Wir <strong>sind</strong> am Wochenende nach Hamburg <strong>gefahren</strong>.</li></ul>
            <h3>Partizip II bilden</h3>
            <table><thead><tr><th>Verbtyp</th><th>Regel</th><th>Beispiel</th></tr></thead><tbody>
            <tr><td>regelmäßig</td><td>ge- + Stamm + -t</td><td>machen → gemacht</td></tr>
            <tr><td>unregelmäßig</td><td>ge- + Stamm (oft Vokalwechsel) + -en</td><td>schreiben → geschrieben</td></tr>
            <tr><td>trennbar</td><td>Präfix + ge + Stamm + -t/-en</td><td>einkaufen → eingekauft</td></tr>
            <tr><td>untrennbar (be-, ver-, er-…)</td><td>kein ge-</td><td>besuchen → besucht</td></tr>
            <tr><td>auf -ieren</td><td>kein ge-</td><td>studieren → studiert</td></tr>
            </tbody></table>""";

    static final String HABEN_SEIN = """
            <p>Die meisten Verben bilden das Perfekt mit <strong>haben</strong>. Mit <strong>sein</strong> bilden \
            das Perfekt:</p>
            <ul><li>Verben der <strong>Bewegung</strong> von A nach B: gehen, fahren, fliegen, laufen, kommen</li>
            <li>Verben der <strong>Zustandsänderung</strong>: aufwachen, einschlafen, sterben, werden</li>
            <li>die Verben <strong>sein</strong>, <strong>bleiben</strong> und <strong>passieren</strong></li></ul>
            <p>Beispiele: Ich <strong>bin</strong> um sieben Uhr aufgewacht. Was <strong>ist</strong> passiert? \
            Er <strong>ist</strong> zu Hause geblieben.</p>
            <blockquote>In Süddeutschland und Österreich sagt man auch: Ich <em>bin</em> gesessen / gestanden.</blockquote>""";

    static final String EMAIL = """
            <h3>Anrede</h3>
            <ul><li>Sehr geehrte Frau Becker, / Sehr geehrter Herr Wagner,</li>
            <li>Sehr geehrte Damen und Herren, (wenn du den Namen nicht kennst)</li></ul>
            <p>Nach der Anrede steht ein Komma, und der erste Satz beginnt <strong>klein</strong>.</p>
            <h3>Aufbau</h3>
            <ol><li>Anlass: <em>ich schreibe Ihnen, weil …</em></li>
            <li>Anliegen und Details</li>
            <li>Bitte / nächster Schritt: <em>Ich würde mich freuen, wenn …</em></li></ol>
            <h3>Grußformel</h3>
            <p>Mit freundlichen Grüßen<br>Luca Rossi</p>""";

    static final String INTERVIEW = """
            <p>Typische Fragen und nützliche Redemittel:</p>
            <ul><li><strong>Erzählen Sie etwas über sich.</strong> – Ich habe … studiert und arbeite seit … als …</li>
            <li><strong>Warum möchten Sie bei uns arbeiten?</strong> – Mich interessiert besonders …</li>
            <li><strong>Was sind Ihre Stärken?</strong> – Ich bin zuverlässig und arbeite gern im Team.</li>
            <li><strong>Haben Sie noch Fragen?</strong> – Wie sieht ein typischer Arbeitstag aus?</li></ul>
            <blockquote>Tipp: Bereite zu jeder Stärke ein konkretes Beispiel vor.</blockquote>""";

    static final String GOETHE = """
            <p>Die Prüfung besteht aus vier Modulen, die du einzeln oder zusammen ablegen kannst:</p>
            <table><thead><tr><th>Modul</th><th>Dauer</th></tr></thead><tbody>
            <tr><td>Lesen</td><td>65 Minuten</td></tr><tr><td>Hören</td><td>ca. 40 Minuten</td></tr>
            <tr><td>Schreiben</td><td>75 Minuten</td></tr><tr><td>Sprechen</td><td>ca. 15 Minuten</td></tr>
            </tbody></table><p>Bestanden hast du ein Modul mit mindestens 60 von 100 Punkten.</p>""";

    static final String EMBED_BODY = """
            <p>Die <strong>Deutsche Welle</strong> bietet kostenlose Kurse, Videos und Übungen für alle Niveaus. \
            Öffne den Link und probiere den Einstufungstest aus.</p>""";

    static final String VOCAB_FILE = """
            Vokabelliste: Begrüßungen und Verabschiedungen (A1)
            ===================================================

            Guten Morgen!          - Good morning!
            Guten Tag!             - Good day! / Hello!
            Guten Abend!           - Good evening!
            Gute Nacht!            - Good night!
            Hallo!                 - Hello! (informell)
            Moin!                  - Hi! (Norddeutschland)
            Grüß Gott!             - Hello! (Süddeutschland, Österreich)
            Wie geht es Ihnen?     - How are you? (formell)
            Wie geht's?            - How are you? (informell)
            Danke, gut.            - Fine, thanks.
            Auf Wiedersehen!       - Goodbye! (formell)
            Tschüss!               - Bye! (informell)
            Bis später!            - See you later!
            Bis morgen!            - See you tomorrow!

            Tipp: Lerne jeden Tag zehn Wörter und sprich sie laut aus.
            """;
}
