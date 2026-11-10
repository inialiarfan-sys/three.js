// Prints the "busiest moment" of each scene, for QA stills:
//   npm run still -- $(npx tsx tools/qa-times.ts) vertical
import { at, wordAfter, atEnd } from '../src/timeline';

const T: [ string, number ][] = [
	[ '00 title', 1.5 ], [ '01 question', at( 'dontHave' ) + 0.7 ], [ '02 jupiterX', at( 'notJupiter' ) + 0.6 ], [ '02 between', at( 'between' ) + 0.6 ],
	[ '03 cape', wordAfter( 'cape', 'cape' ) + 0.3 ], [ '04 hopIn', at( 'adventure' ) - 0.1 ], [ '04 blast', atEnd( 'adventure' ) + 0.6 ],
	[ '05 lineup', at( 'smaller' ) + 0.9 ], [ '05 rockyOcean', at( 'oceans' ) + 0.8 ], [ '06 tally', at( 'mostCommon' ) + 0.6 ], [ '06 gap', at( 'none' ) + 1.2 ],
	[ '07 soldOut', wordAfter( 'noMedium', 'medium' ) + 0.5 ], [ '07 fries', at( 'ranOut' ) + 0.8 ], [ '08 heavy', at( 'twice' ) + 0.6 ],
	[ '09 scary', at( 'scary' ) + 0.6 ], [ '09 blame', at( 'blame' ) + 0.5 ], [ '10 stairs', at( 'legDay' ) + 0.2 ], [ '11 map', at( 'visit' ) + 2.6 ],
	[ '12 panic', at( 'watch' ) + 1.0 ], [ '12 crispy', wordAfter( 'crispy', 'crispy' ) + 0.4 ], [ '13 cutaway', at( 'water' ) + 1.0 ],
	[ '13 tenJackets', at( 'ten' ) + 0.95 ], [ '13 roll', at( 'ten' ) + 1.5 ], [ '14 hint', at( 'hint' ) + 0.6 ],
	[ '15 dive', at( 'dive' ) + 3 ], [ '16 shadow', at( 'big' ) + 0.6 ], [ '16 eyes', at( 'looking' ) + 1.1 ], [ '17 chase', at( 'gogo' ) + 0.2 ],
	[ '17 blastAway', wordAfter( 'gogo', 'go', 2 ) + 1.2 ], [ '18 phew', at( 'phew' ) + 1.6 ], [ '19 bubble', at( 'imagination' ) + 0.5 ], [ '19 notYet', at( 'notYet' ) + 0.5 ],
	[ '20 galaxy', at( 'commonOut' ) + 1 ], [ '20 earth', at( 'rarer' ) + 2.5 ], [ '21 hill', at( 'youCan' ) + 0.7 ], [ '22 wave', at( 'amazing' ) + 1.6 ], [ '22 end', at( 'beginning' ) + 1.2 ],
];

console.log( T.map( ( [ , t ] ) => t.toFixed( 2 ) ).join( ' ' ) );
console.error( T.map( ( [ n, t ] ) => `${ n }=${ t.toFixed( 2 ) }` ).join( '\n' ) );
