#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "SpaceSystemLevelActor.generated.h"

class UMaterialInstanceDynamic;
class UMaterialInterface;
class UActorComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;
class IWebSocket;

struct FSpaceSystemPlanetView
{
	FString Id;
	FString Name;
	FString Faction;
	FVector2D MapPosition = FVector2D::ZeroVector;
	FLinearColor Color = FLinearColor::White;
	float Scale = 1.0f;
};

struct FSpaceSystemShipView
{
	FString Id;
	FString Name;
	FString Faction;
	FString OwnerClientId;
	FString DestinationPlanetId;
	FVector2D MapPosition = FVector2D::ZeroVector;
	FVector2D DestinationMapPosition = FVector2D::ZeroVector;
	float Fuel = 0.0f;
	float FuelCapacity = 1.0f;
	bool bHasDestination = false;
};

struct FSpaceSystemExploredAreaView
{
	FVector2D Center = FVector2D::ZeroVector;
	float Radius = 1.0f;
};

UCLASS()
class UNREALCLIENT_API ASpaceSystemLevelActor : public AActor
{
	GENERATED_BODY()

public:
	ASpaceSystemLevelActor();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	UPROPERTY()
	USceneComponent* SceneRoot;

	UPROPERTY()
	UStaticMesh* SphereMesh;

	UPROPERTY()
	UStaticMesh* CubeMesh;

	UPROPERTY()
	UStaticMesh* CylinderMesh;

	UPROPERTY()
	UMaterialInterface* BaseMaterial;

	TArray<FSpaceSystemPlanetView> Planets;
	TArray<FSpaceSystemShipView> Ships;
	TArray<FSpaceSystemExploredAreaView> ExploredAreas;
	TArray<TObjectPtr<UActorComponent>> RefreshableComponents;
	TSharedPtr<IWebSocket> WorldSocket;
	FTimerHandle ReconnectTimer;

	FString ServerHttpBaseUrl = TEXT("http://127.0.0.1:3016");
	FString ServerWebSocketUrl = TEXT("ws://127.0.0.1:3016/ws?client=user&clientId=unreal-client&name=Unreal%20Client");
	FString ClientId = TEXT("unreal-client");
	FString PilotName = TEXT("Unreal Pilot");
	FString ConnectionStatus = TEXT("offline");
	int32 WorldTick = 0;
	bool bSpawnRequested = false;
	bool bUsingLiveSnapshot = false;
	bool bAllowReconnect = true;

	void BuildPlanetData();
	void BuildLighting();
	void BuildGrid();
	void BuildStars();
	void RebuildRefreshableScene();
	void ClearRefreshableScene();
	void BuildPlanets();
	void BuildRoutes();
	void BuildShips();
	void BuildStatusBeacon();
	void ConnectToServer();
	void ScheduleReconnect();
	void HandleSocketConnected();
	void HandleSocketConnectionError(const FString& Error);
	void HandleSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
	void HandleSocketMessage(const FString& Message);
	void ApplyWorldPayload(const TSharedPtr<class FJsonObject>& Payload);
	void RequestSpawnIfNeeded(const TSharedPtr<class FJsonObject>& Payload);
	void HandleSpawnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully);

	FVector ToWorldPosition(const FVector2D& MapPosition, float Height = 0.0f) const;
	UMaterialInstanceDynamic* CreateColorMaterial(const FLinearColor& Color, FName Name);
	UStaticMeshComponent* AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bRefreshable = true);
	UTextRenderComponent* AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color, bool bRefreshable = true);
	void AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color, bool bRefreshable = true);
	const FSpaceSystemPlanetView* PlanetById(const FString& PlanetId) const;
};