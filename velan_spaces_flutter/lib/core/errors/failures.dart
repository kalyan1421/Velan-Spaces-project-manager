abstract class Failure {
  const Failure([this.message = 'An unexpected error occurred.']);
  final String message;
}

class ServerFailure extends Failure {
  const ServerFailure(String message) : super(message);
}
