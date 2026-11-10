// Prints the "busiest moment" of each scene, for QA stills:
//   npm run still -- $(npx tsx tools/qa-times.ts) vertical
import { at, wordAfter } from '../src/timeline';

const T: [ string, number ][] = [
	[ '00 title', 1.8 ], [ '01 sunsetX', at( 'noSunset' ) + 0.35 ], [ '01 ever', at( 'ever' ) + 0.3 ], [ '02 drift', at( 'darkness' ) + 2.2 ],
	[ '03 billions', at( 'billionsWord' ) + 0.6 ], [ '04 click', wordAfter( 'flashlight', 'flashlight' ) + 0.7 ], [ '05 system', at( 'most' ) + 1.2 ],
	[ '05 rogue', wordAfter( 'rogue', 'rogue' ) + 0.6 ], [ '06 wander', at( 'ball' ) + 0.5 ], [ '07 giant', at( 'giant' ) + 1.5 ], [ '07 pushed', at( 'pushed' ) + 0.6 ],
	[ '08 chat', wordAfter( 'chat', 'kicked' ) + 0.6 ], [ '08 forever', at( 'forever' ) + 0.45 ], [ '09 search', at( 'doesntShine' ) + 1.0 ],
	[ '10 bend', at( 'bends' ) + 1.2 ], [ '10 brighter', at( 'brighter' ) + 0.3 ], [ '10 something', at( 'something' ) + 0.6 ],
	[ '11 land', at( 'found' ) + 1.7 ], [ '12 frost', at( 'antarctica' ) + 1.4 ], [ '13 sunscreen', at( 'sunscreen' ) + 1.2 ], [ '13 noSun', at( 'noSun' ) + 0.7 ],
	[ '14 cutaway', at( 'ocean' ) + 1.0 ], [ '15 shine', at( 'shine' ) + 1.2 ], [ '16 crack', at( 'crack' ) + 0.25 ], [ '16 breaking', at( 'breaking' ) + 0.6 ],
	[ '17 chase', at( 'run' ) + 0.7 ], [ '17 blast', at( 'run' ) + 2.3 ], [ '18 phew', at( 'phew' ) + 1.6 ], [ '19 models', at( 'models' ) + 0.8 ], [ '19 telescope', at( 'newTel' ) + 2.0 ],
	[ '20 rogue', at( 'drifts' ) + 1 ], [ '20 sunrise', at( 'everyDay' ) + 1.0 ], [ '21 dawn', at( 'youCan' ) + 0.5 ], [ '22 wave', at( 'amazing' ) + 1.6 ], [ '22 end', at( 'beginning' ) + 1.2 ],
];

console.log( T.map( ( [ , t ] ) => t.toFixed( 2 ) ).join( ' ' ) );
console.error( T.map( ( [ n, t ] ) => `${ n }=${ t.toFixed( 2 ) }` ).join( '\n' ) );
