<?php

namespace NeuraVolt\Collects;

class CollectsException extends \Exception {
    protected ?int $statusCode;
    protected ?array $responseBody;

    public function __construct(string $message, int $code = 0, ?int $statusCode = null, ?array $responseBody = null, ?\Throwable $previous = null) {
        parent::__construct($message, $code, $previous);
        $this->statusCode = $statusCode;
        $this->responseBody = $responseBody;
    }

    public function getStatusCode(): ?int {
        return $this->statusCode;
    }

    public function getResponseBody(): ?array {
        return $this->responseBody;
    }
}

class CollectsAuthenticationException extends CollectsException {}
class CollectsValidationException extends CollectsException {}
class CollectsConflictException extends CollectsException {}
