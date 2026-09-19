import 'package:flutter_test/flutter_test.dart';
import 'package:red_sun/main.dart';

void main() {
  testWidgets('Red Sun app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const RedSunApp());
    expect(find.text('THE RED SUN'), findsOneWidget);
  });
}
